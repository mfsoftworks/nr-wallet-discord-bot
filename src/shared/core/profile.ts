export class Profile {
    public token: string;
    public currency: string;
    public id: string;
    public wallet_id: number;

    constructor (data: {id?: string; token?: string; currency?: string}) {
        Object.assign(this, data)
    }

    get linked(): boolean {
        return !!this.token;
    }

    set linked(linked: boolean) {
        return
    }
}
