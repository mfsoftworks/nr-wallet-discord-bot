export class Args extends Array<string> {
    // Create args array from string
    constructor(s: string) {
        super(
            ...s.toLowerCase()
            .split(' ')
            .map((v: string) => v.trim())
            .filter((v: string) => v != '')
        )
    }

    // Find first number in args
    findFirstNumber(offset = 0, excludes?: string[], notEqual?: number[]): number | boolean {
        // Find first amount in args
        const amount = this.find((c, i) => i >= offset && !excludes.includes(c) && this.isNumber(c))

        // Return valid number or false
        if (amount && this.isNumber(amount) && !notEqual.includes(parseFloat(amount)) && parseFloat(amount) > 0) {
            return parseFloat(amount)
        }
        return false
    }

    // Find keyword in args
    findKeyword(keywords: string[], offset = 0): string | boolean {
        // Find keyword
        const keyword = this.find((c, i) => i >= offset && keywords.includes(c))

        // Return currency or false
        return keyword ? keyword : false
    }

    // Find keywords in args
    findKeywords(keywords: string[], offset = 0): Array<string> | boolean {
        // Find keyword
        const keyword = this.filter((c, i) => i >= offset && keywords.includes(c))

        // Return currency or false
        return keyword ? keyword : false
    }

    // Combine args into string
    combineArgs(excludes: string[], offset = 0): string {
        return this.reduce(
            (t, c, i) => t += (i < offset || excludes.includes(c)) ? '' : `${c} `,
        '').trim().toLowerCase()
    }

    // Number type checking
    private isNumber(value: string | number): boolean {
       return (
            (value != null) &&
            (value !== '') &&
            !isNaN(Number(value.toString()))
        );
    }
}
