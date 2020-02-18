import { Message } from 'discord.js'

export class Transaction {
    public guild: string
    public sender: string
    public amount: number | boolean
    public currency: string | boolean
    public users: string[]
    public action: string | null | boolean

    constructor(message?: Message, data? : object) {
        if (message) {
            this.guild = message.guild.id
            this.sender = message.author.id
        }
        Object.assign(this, data)
    }
}