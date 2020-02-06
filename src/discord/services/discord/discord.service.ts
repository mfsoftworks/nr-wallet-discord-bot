import { Injectable } from '@nestjs/common';
import { Client, RichEmbed, Message, Attachment, User, DMChannel } from 'discord.js'
import { SHA256, enc } from 'crypto-js'
import accounting from 'accounting'
import config from 'config'
import { Colours } from '../../core/colours.enum'
import { Profile } from '../../../shared/core/profile'
import { Transaction } from '../../../shared/core/transaction';
import { ProfileService } from '../../../shared/services/profile/profile.service';
import { TransactionService } from '../../../shared/services/transaction/transaction.service';
import { Args } from '../../core/args';

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
            'usd',
            'sgd'
        ], action: [
            'split',
            'each'
        ]
    }

    constructor(
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

    private async onMessage(message: Message): Promise<Message | Message[]> {
        let user: Profile
        const args = new Args(message.content)
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
                    '*Ex: $send @nygmarose @knightofhonour 13.37 SGD each*'
                )
                break

            case '$currencies':
            case '$currencys':
                message.channel.send(`Currently NR Wallet accepts: ${DiscordService.keywords.currency.map((c: string) => c.toUpperCase()).join(', ')}`)
                break

            case '$link':
                user = await this._profile.get(message.author.id)

                // If user is linked reply with status
                if (user.linked) {
                    return message.reply(`It looks like you're already linked up`)
                }

                // Create DM channel
                const channel = await message.author.createDM()

                // Send link to channel
                if (channel) {
                    channel.send(
                        new RichEmbed()
                            .setTitle('NR Wallet Login Link')
                            .setDescription(`Hey ${message.author.toString()}, you can link your wallet here. You'll be asked to login and then you'll be directed back to our website once your account is linked! Just click the title right there.`)
                            .setColor(DiscordService.colours.info)
                            .setURL(`${config.get('wallet.endpoint')}/oauth/authorize?client_id=${config.get('wallet.client')}&redirect_uri=${config.get('wallet.redirect_uri')}&response_type=code&scope=${config.get('wallet.scope')}&state=${message.author.id},${SHA256(message.author.id, config.get('wallet.secret')).toString(enc.Hex)}`)
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
                user = await this._profile.get(message.author.id)

                // Check if user is linked
                if (!this.linkCheck(user, message)) return

                // TODO: Update user balance

                // Send users available and pending balance
                message.reply(`Available balance: ${user.balance.available} ${user.currency}\nPending balance: ${user.balance.pending} ${user.currency}`)
                break

            case '$wallet':
                user = await this._profile.get(message.author.id)

                // Check if user is linked
                if (!this.linkCheck(user, message)) return

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
                user = await this._profile.get(message.author.id)

                // Check if user is linked
                if (!this.linkCheck(user, message)) return

                // Check if DM or group
                if (!message.guild) {
                    return message.reply(`Hey ${message.author.toString()}, I'll need you to do that in a group to send to someone`)
                }

                // Create transaction
                const transaction = new Transaction(message)

                // Get currency mentioned
                transaction.currency = args.findKeyword(this.getKeywords('currency'), 1)
                if (!transaction.currency) {
                    return message.reply(`Awesome. Now, can you send that again with a currency?`)
                }

                // Get amount mentioned
                transaction.amount = args.findFirstNumber(1)
                if (!transaction.amount) {
                    return message.reply(`Uhhh I couldn't see any amount there`)
                }

                // Format amount to decimal number
                transaction.amount = DiscordService.formatCurrency(transaction.amount as number, transaction.currency as string)

                // TODO: Convert currencies if needed (transaction.amount -> user.source.default)

                // Get users mentioned
                transaction.users = message.mentions.users.array().filter(u => u.id !== message.author.id && !u.bot && !!message.guild.member(u)).map(u => u.id)

                if (!transaction.users.length) {
                    return message.reply(`That would be awesome but I couldn't see anyone to send to, make sure you mention them *and* they're in this group`)
                }

                // Check if users are all linked
                const profiles: Profile[] = await Promise.all(
                   transaction.users.map(u => this._profile.get(u))
                )
                const unlinked: Profile[] = profiles.filter((p: Profile) => !p.linked)
                if (unlinked.length) {
                    return message.reply(`${unlinked.length > 1 ? 'These users' : 'This user'} hasn't linked an account: ${unlinked.map((u: Profile) => `<@${u.id}>`).join(', ')}`)
                }

                // If multiple users check for action to perform
                if (transaction.users.length > 1) {
                    transaction.action = args.findKeyword(this.getKeywords('action'), 1)
                    if (!transaction.action) {
                        return message.reply(`Can you copy paste that message but let me know if I should send then ${transaction.amount} ${transaction.currency} \`each\` or should I \`split\` between them`)
                    }
                }

                // Save transaction
                this._transaction.save(transaction)

                // Return confirmation message
                return message.reply(transaction.toString())

            case '$confirm':
                // Check not a DM
                if (!message.guild) {
                    return message.reply(`Well you can't pay me so I don't have a transaction for this DM`)
                }

                user = await this._profile.get(message.author.id)

                // Check if user is linked
                if (!this.linkCheck(user, message)) return

                // Get pending transaction
                const confirmation = await this._transaction.get(message)

                // Return an error if no pending transaction
                if (!confirmation) {
                    return message.reply('Sure thing! I couldn\'t find anything to confirm though.')
                }

                // TODO: Send out the money
                // transaction.execute()

                // DM the recipients
                confirmation.users.forEach((u: string | User) => {
                    u = this.client.users.find('id', u)
                    u.createDM().then((c: DMChannel) => {
                        c.send(`Hey ${u.toString()}! ${this.client.users.find('id', confirmation.sender).username} sent a full ${confirmation.amount} ${confirmation.currency} to your NR Wallet!`)
                    })
                })

                // Confirm with the sender
                message.reply('Will do. Everything\'s been sent out and everyone DM\'d')
                break

            case '$source':
            case '$sauce':
                user = await this._profile.get(message.author.id)

                // Check if user is linked
                if (!this.linkCheck(user, message)) return

                // Send warning if guild
                if (message.guild) {
                    message.reply(`Shhh... we shouldn't talk about that here`)
                }

                // TODO: Get sources and send to DM
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
        return message.reply(new Attachment(`I'm sorry ${message.author.toString()}, I can't do that`, 'https://media1.tenor.com/images/86937766f3f44884362c716e8f1d0e19/tenor.gif'))
    }

    // Format currency input
    private static formatCurrency(value: number, currency: string): number {
        if (['EUR'].includes(currency)) {
            return accounting.unformat(value.toString(), ',')
        } else {
            return accounting.unformat(value.toString())
        }
    }
}
