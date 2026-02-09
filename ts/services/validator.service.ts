export class ValidatorService {
  static isValidUrl(url: string): boolean {
    return /^https?:\/\//.test(url);
  }
}
