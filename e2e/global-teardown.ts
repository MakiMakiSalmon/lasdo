import { writeContactSheet } from './contact-sheet';

/** 全 spec 完了後にコンタクトシート(index.html / index.md)を生成する。 */
export default function globalTeardown(): void {
  writeContactSheet();
}
