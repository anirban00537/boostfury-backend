import { Transform } from 'class-transformer';

export function TransformHeadshot(prefix: string) {
  return Transform(({ value }) => {
    if (value && typeof value === 'string') {
      if (value.startsWith('/')) {
        return `${prefix}${value}`;
      } else if (!value.startsWith('http')) {
        return `${prefix}/${value}`;
      }
    }
    return value;
  });
}
