export class Profile {
    public token: string
    public balance: {
        available: number;
        pending: number;
    }
    public currency: string
    public sources: any
    public id: string
    public linked = false

    constructor (data?: object) {
        Object.assign(this, data)
        this.linked = !!this.token
    }

    toJSON(): string {
        return JSON.stringify(this)
    }
}
