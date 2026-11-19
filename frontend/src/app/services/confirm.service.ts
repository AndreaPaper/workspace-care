import { ApplicationRef, EnvironmentInjector, Injectable, createComponent, inject } from '@angular/core';
import { ConfirmBox, ConfirmOptions } from '../core/ui/confirm-box';

type Choice = string | null;

/**
 * Replaces window.confirm and the Material dialogs. The box is drawn next to the element that asked (design M2):
 * inside the detail panel, under an inline form or row, or as a bottom sheet on a phone. While it is open the part
 * of the page it belongs to is locked (inert); Escape cancels and the focus goes back to the button that opened it.
 */
@Injectable({ providedIn: 'root' })
export class ConfirmService {
  private readonly appRef = inject(ApplicationRef);
  private readonly env = inject(EnvironmentInjector);
  private close: ((value: boolean | Choice) => void) | null = null;

  /** Yes/no and deletion questions. */
  ask(options: Omit<ConfirmOptions, 'kind'> & { kind?: 'delete' | 'question' }): Promise<boolean> {
    return this.open({ ...options, kind: options.kind ?? 'delete' }) as Promise<boolean>;
  }

  /** Pick one of several cards; resolves to the chosen id, or null when cancelled. */
  choose(options: Omit<ConfirmOptions, 'kind'>): Promise<string | null> {
    return this.open({ ...options, kind: 'choice' }) as Promise<Choice>;
  }

  private open(options: ConfirmOptions): Promise<boolean | Choice> {
    this.close?.(options.kind === 'choice' ? null : false);
    const anchor = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const phone = window.matchMedia('(max-width: 479px)').matches;

    const ref = createComponent(ConfirmBox, { environmentInjector: this.env });
    ref.setInput('opts', options);
    this.appRef.attachView(ref.hostView);
    const node = ref.location.nativeElement as HTMLElement;

    // Where the box goes, and which part of the page is locked meanwhile.
    const locked: HTMLElement[] = [];
    if (phone) {
      document.body.appendChild(node);
    } else {
      const detail = anchor?.closest<HTMLElement>('.md-detail');
      const inline = anchor?.closest<HTMLElement>('.edit, .rename, .rule, .row-wrap, li, article, .card, .panel');
      if (detail) {
        detail.appendChild(node);
        locked.push(...(Array.from(detail.children) as HTMLElement[]).filter((c) => c !== node));
      } else if (inline?.matches('.panel')) {
        inline.appendChild(node);
        locked.push(...(Array.from(inline.children) as HTMLElement[]).filter((c) => c !== node));
      } else if (inline) {
        inline.after(node);
        locked.push(inline);
      } else {
        (document.querySelector('main') ?? document.body).appendChild(node);
      }
    }
    for (const el of locked) el.setAttribute('inert', '');

    return new Promise((resolve) => {
      const finish = (value: boolean | Choice) => {
        if (this.close !== finish) return;
        this.close = null;
        for (const el of locked) el.removeAttribute('inert');
        sub.unsubscribe();
        this.appRef.detachView(ref.hostView);
        ref.destroy();
        node.remove();
        if (anchor?.isConnected) anchor.focus();
        resolve(value);
      };
      this.close = finish;
      const sub = ref.instance.result.subscribe((v) => finish(v as boolean | Choice));
      ref.changeDetectorRef.detectChanges();
    });
  }
}
