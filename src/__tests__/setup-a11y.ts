import { toHaveNoViolations } from 'jest-axe';

expect.extend(toHaveNoViolations);

// Type declaration for jest-axe matchers
declare global {
  namespace jest {
    interface Matchers<R> {
      toHaveNoViolations(): R;
    }
  }
}
