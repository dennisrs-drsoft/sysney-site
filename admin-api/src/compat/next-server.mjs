// The administrative handlers only use the standard Web Request/Response APIs.
export class NextRequest extends Request {
  get nextUrl() { return new URL(this.url); }
}
export class NextResponse extends Response {}
