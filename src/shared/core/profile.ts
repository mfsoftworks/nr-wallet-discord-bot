import { HttpService } from "@nestjs/common";

export class Profile {
    public token: string;
    public currency: string;
    public id: string;

    constructor (data: {id?: string; token?: string; currency?: string}, private readonly http?: HttpService) {
        Object.assign(this, data)
    }

    get linked(): boolean {
        return !!this.token;
    }

    set linked(linked: boolean) {
        return
    }
}
