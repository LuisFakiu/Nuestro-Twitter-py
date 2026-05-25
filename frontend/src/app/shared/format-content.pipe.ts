import { Pipe, PipeTransform } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';

@Pipe({
  name: 'formatContent',
  standalone: true,
})
export class FormatContentPipe implements PipeTransform {
  constructor(private sanitizer: DomSanitizer) {}

  transform(value: string): SafeHtml {
    if (!value) return '';
    let html = value;
    html = html.replace(
      /@(\w+)/g,
      '<a href="/users/$1" class="mention-link">@$1</a>'
    );
    html = html.replace(
      /#(\w+)/g,
      '<a href="/search?q=$1&tab=hashtags" class="hashtag-link">#$1</a>'
    );
    return this.sanitizer.bypassSecurityTrustHtml(html);
  }
}
