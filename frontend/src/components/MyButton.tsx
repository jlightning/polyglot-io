import { forwardRef } from 'react';
import { Button } from '@radix-ui/themes';
import type { ButtonProps } from '@radix-ui/themes';

const MyButton = forwardRef<HTMLButtonElement, ButtonProps>((props, ref) => {
  const style = props.style || {};
  const disabled = !!props.disabled;

  return (
    <Button
      ref={ref}
      {...props}
      style={{ ...style, cursor: disabled ? 'not-allowed' : 'pointer' }}
    />
  );
});

MyButton.displayName = 'MyButton';

export default MyButton;
