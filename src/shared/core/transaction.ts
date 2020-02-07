import { Message } from 'discord.js'
import Decimal from 'decimal.js'

export class Transaction {
    public message: Message
    public sender: string
    public amount: string | number | boolean
    public currency: string | boolean
    public users: string[]
    public action: string | null | boolean

    constructor(message?: Message, data? : object) {
        this.message = message
        this.sender = message.author.id
        Object.assign(this, data)
    }

    // Execute with server
    public execute(): void {
        // Set number as a decimal
        const dec = new Decimal(this.amount as number)

        // Convert number to lowest common denominator (* 10^decimalPlaces)
        const total = dec.decimalPlaces() > 0 ? dec.times(new Decimal(10).pow(dec.decimalPlaces())) : dec

        // TODO: Send { total, this.currency }, to server with sender token and user id
    }

    // Return transaction to string
    toString(): string {
        return `Awesome! I'll ${this.action === 'split' ? 'split' : 'send'}:\n\n` +
        `${this.amount} ${this.currency} ${this.action === 'split' ? 'between' : 'to'} ${this.users.length === 1 ? `<@${this.users[0]}>\n` : this.users.reduce((t: string, u: string) => t += `<@${u}>\n`, '\n\n')}` +
        `\nSend a \`$confirm\` to confirm this transaction`
    }
}