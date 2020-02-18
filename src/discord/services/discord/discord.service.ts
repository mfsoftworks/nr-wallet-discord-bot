import { Injectable } from '@nestjs/common';
import { Client, RichEmbed, Message, Attachment, User, DMChannel } from 'discord.js'
import { SHA256, enc } from 'crypto-js'
import config from 'config'
import { Colours } from '../../core/colours.enum'
import { Profile } from '../../../shared/core/profile'
import { Transaction } from '../../../shared/core/transaction';
import { ProfileService } from '../../../shared/services/profile/profile.service';
import { TransactionService } from '../../../shared/services/transaction/transaction.service';
import { Args } from '../../core/args';
import { BalanceAmount } from 'src/discord/core/balance';
import { MoneyService } from '../money/money.service';
import { tap } from 'rxjs/operators';

interface Keywords {
    currency: string[];
    action: string[];
}

@Injectable()
export class DiscordService {
    public client: Client
    private static readonly colours = Colours
    private static readonly keywords: Keywords = {
        currency: [
            'aud',
            'sgd',
            'eur'
        ], action: [
            'split',
            'each'
        ]
    }

    constructor(
        private _money: MoneyService,
        private _profile: ProfileService,
        private _transaction: TransactionService
    ) {
        // Create client
        this.client = new Client()

        // On client ready
        this.client.once('ready', this.onReady.bind(this))

        // On message recieved handle return
        this.client.on('message', this.onMessage.bind(this))

        // Client login
        this.client.login(config.get('discord_token'))
    }

    private onReady(): void {
        // Log ready
        console.log('Discord monitor running')
    }

    private async onMessage(message: Message): Promise<void> {
        const user: Profile = await this._profile.get(message.author.id)
        const args = new Args(message.content)
        let channel: DMChannel

        console.log('Received', args)

        switch (args[0]) {
            case '$help':
                message.channel.send(
                    '** NR Wallet Commands **\n\n' +
                    '`$currencies` View accepted currencies\n\n' +
                    '`$currencys` Same as `$currencies`\n\n' +
                    '`$link` Link with NR Wallet to begin sending and receiving\n\n' +
                    '`$balance` View linked wallet balance\n\n' +
                    '`$send @user1 [@user2] amount currency [[each] [split]]` Send some money to someone\n\n' +
                    '`$confirm` Confirm your transaction before we send it out\n\n' +
                    '`$source [source]` View and set available payment sources (`$source` to view `$source [source]` to set)\n\n' +
                    '`$sauce` Same as `$source`\n\n' +
                    '`$wallet` Get a link to your NR Wallet\n\n' +
                    '*To detect the correct amount, money needs to have a `.` decimal seperator*\n\n' +
                    '*Ex: $send @nygmarose @knightofhonour 13.37 SGD each*'
                )
                break

            case '$currencies':
            case '$currencys':
                message.channel.send(`Currently NR Wallet accepts: ${DiscordService.keywords.currency.map((c: string) => c.toUpperCase()).join(', ')}`)
                break

            case '$link':
                // If user is linked reply with status
                if (user.linked) {
                    message.reply(`It looks like you're already linked up`)
                    return
                }

                // Create DM channel
                channel = await message.author.createDM()

                // Send link to channel
                if (channel) {
                    channel.send(
                        new RichEmbed()
                            .setTitle('NR Wallet Login Link')
                            .setDescription(`Hey ${message.author.toString()}, you can link your wallet here. You'll be asked to login and then you'll be directed back to our website once your account is linked! Just click the title right there.`)
                            .setColor(DiscordService.colours.info)
                            .setURL(
                                encodeURI(
                                    `${config.get('wallet.endpoint')}/oauth/authorize?client_id=${config.get('wallet.client')}&redirect_uri=${config.get('wallet.redirect_uri')}&response_type=code&scope=${config.get('wallet.scope')}&state=${message.author.id},${SHA256(message.author.id, config.get('wallet.secret')).toString(enc.Hex)}`
                                )
                            )
                            .setThumbnail('https://glamsquad.sgp1.cdn.digitaloceanspaces.com/SocialHub/default/images/Logo_Transparent%20White.png')
                    )

                    // Send confirmation if guild
                    if (message.guild) {
                        message.reply(`You got it, I DM'd you the link`)
                    }
                    return
                }

                // Send error if no channel
                message.reply(`Hey uhm, I couldn't DM you, can you make sure I'm not blocked or anything?`)
                break

            case '$balance':
                // Check if user is linked
                if (!this.linkCheck(user, message)) {
                    return
                }

                // Get user balance
                this._profile.balance(user).subscribe((b: BalanceAmount) => {
                    // Send users available and pending balance
                    message.reply(`Available balance: ${this._money.format(b.amount, b.currency)}`);
                });
                break

            case '$wallet':
                // Check if user is linked
                if (!this.linkCheck(user, message)) {
                    return
                }

                message.reply(
                    new RichEmbed()
                        .setTitle('NR Wallet')
                        .setDescription(`Hey ${message.author.toString()}, you can check your full wallet here. You'll be sent to NR Wallet online, or you can open the app directly if it's installed! Just click the title right there.`)
                        .setColor(DiscordService.colours.success)
                        .setURL(config.get('wallet.app'))
                        .setThumbnail('https://glamsquad.sgp1.cdn.digitaloceanspaces.com/SocialHub/default/images/Logo_Transparent%20White.png')
                )
                break

            case '$send':
                // Check if user is linked
                if (!this.linkCheck(user, message)) {
                    return
                }

                // Check if DM or group
                if (!message.guild) {
                    message.reply(`Hey ${message.author.toString()}, I'll need you to do that in a group to send to someone`)
                    return
                }

                // Create transaction
                const transaction = new Transaction(message)

                // Get currency mentioned
                transaction.currency = args.findKeyword(this.getKeywords('currency'), 1)
                if (!transaction.currency) {
                    message.reply(`Awesome. Now, can you send that again with a currency?`)
                    return
                }

                // Get amount mentioned
                transaction.amount = args.findFirstNumber(1)
                if (!transaction.amount) {
                    message.reply(`Uhhh I couldn't see any amount there`)
                    return
                }

                // Format amount to decimal number
                transaction.amount = this._money.unformat(transaction.amount as number, transaction.currency as string)

                // Get users mentioned
                transaction.users = message.mentions.users.array().filter(u => u.id !== message.author.id && !u.bot && !!message.guild.member(u)).map(u => u.id)

                if (!transaction.users.length) {
                    message.reply(`That would be awesome but I couldn't see anyone to send to, make sure you mention them *and* they're in this group`)
                    return
                }

                // Check if users are all linked
                const profiles: Profile[] = await Promise.all(
                   transaction.users.map(u => this._profile.get(u))
                )
                const unlinked: Profile[] = profiles.filter((p: Profile) => !p.linked)
                if (unlinked.length) {
                    message.reply(`${unlinked.length > 1 ? 'These users' : 'This user'} hasn't linked an account: ${unlinked.map((u: Profile) => `<@${u.id}>`).join(', ')}`)
                    return
                }

                // If multiple users check for action to perform
                if (transaction.users.length > 1) {
                    transaction.action = args.findKeyword(this.getKeywords('action'), 1)
                    if (!transaction.action) {
                        message.reply(`Can you copy paste that message but let me know if I should send then ${transaction.amount} ${transaction.currency} \`each\` or should I \`split\` between them`)
                        return
                    }
                }

                // Save transaction
                this._transaction.save(transaction)

                // Return confirmation message
                message.reply(this._transaction.toString(transaction))
                break

            case '$confirm':
                // Check not a DM
                if (!message.guild) {
                    message.reply(`Well you can't pay me so... I don't have any transaction to do for this DM`)
                    return
                }

                // Check if user is linked
                if (!this.linkCheck(user, message)) {
                    return
                }

                // Get pending transaction
                const confirmation = await this._transaction.get(message)

                // Return an error if no pending transaction
                if (!confirmation) {
                    message.reply('Sure thing! I couldn\'t find anything to confirm though.')
                    return
                }

                // Get transaction recipe
                const execute = await this._transaction.execute(confirmation, message)

                // Send update message
                message.reply('Roger, processing now')

                // Execute and respond with status
                execute.pipe(
                    tap(console.log),
                ).subscribe(() => {
                    // DM the recipients
                    confirmation.users.forEach((u: string | User) => {
                        u = this.client.users.find('id', u)
                        u.createDM().then((c: DMChannel) => {
                            c.send(`Hey ${u.toString()}! ${this.client.users.find('id', confirmation.sender).username} sent a full ${this._money.format(confirmation.amount as number, confirmation.currency as string)} to your NR Wallet!`)
                        })
                    })

                    // Confirm with the sender
                    message.reply('Done! Everything\'s been sent out and everyone DM\'d')

                    // Clear tx
                    this._transaction.clear(confirmation)
                }, err => message.reply(`Unfortunately, an error happened in sending ${JSON.stringify(err)}`))
                break

            case '$source':
            case '$sauce':
                // Check if user is linked
                if (!this.linkCheck(user, message)) {
                    return
                }

                // Send warning if guild
                if (message.guild) {
                    message.reply(`Shhh... we shouldn't talk about that here, I'll DM you`)
                }

                // Create DM channel
                channel = await message.author.createDM()

                // Send link to channel
                if (channel) {
                    this._profile.sources(user).subscribe(s =>
                        channel.send(`Hey ${message.author.toString()}, your current sources:\n${
                            s.reduce((str, source, i, arr) => str += `${source.card.brand[0].toUpperCase() + source.card.brand.slice(1)} ${source.type[0].toUpperCase() + source.type.slice(1)} — ${source.card.last4}\t(${source.card.exp_month}/${source.card.exp_year})${i !== arr.length-1 ? '\n':''}`, '')
                        }`)
                    )
                    return
                }

                // Send error if no channel
                message.reply(`Hey uhm, I couldn't DM you, can you make sure I'm not blocked or anything?`)
                break

            case '$cena':
                this.unauthorised(message)
                break
        }
    }

    public async authorised(user: Profile): Promise<Message | Message[]> {
        const profile = this.client.users.find(u => u.id == user.id)
        const dm = await profile.createDM()
        return dm.send(`Awesome ${profile.toString()}, we've successfully linked your account!`)
    }

    private linkCheck(user: Profile, message: Message): boolean {
        if (!user.linked) {
            message.reply(`It looks like you haven't linked an account yet! Use \`$link\` to link with your NR Wallet account`)
        }
        return user.linked
    }

    private getKeywords(type?: keyof Keywords): string[] {
        if (!type) {
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            return Array.prototype.concat(...Object.entries(DiscordService.keywords).map(([key, value]) => value))
        }
        return DiscordService.keywords[type] || []
    }

    // Reply with an unauthorised message
    private unauthorised(message: Message): Promise<Message | Message[]> {
        return message.channel.send(`I'm sorry ${message.author.toString()}, you can't see this`, new Attachment('https://media1.tenor.com/images/86937766f3f44884362c716e8f1d0e19/tenor.gif'))
    }
}
