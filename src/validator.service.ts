
// Validator Service
export class ValidatorService {
  // static validateNewItem(name: string, url: string, parent: string, existingNames: string[]): string | null {
  //   if (name.length === 0) {
  //     return 'Name must be populated';
  //   }
    
  //   if (existingNames.includes(name)) {
  //     return 'Name already taken';
  //   }
    
  //   if (url.length > 0 && !this.isValidUrl(url)) {
  //     return 'URL format invalid';
  //   }
    
  //   if (parent.length > 0 && !existingNames.includes(parent)) {
  //     return 'Parent does not exist';
  //   }
    
  //   return null;
  // }

  static isValidUrl(url: string): boolean {
    return /^https?:\/\//.test(url);
  }
}