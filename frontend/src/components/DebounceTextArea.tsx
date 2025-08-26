import React, { useState, useCallback, useEffect, useRef } from 'react';
import { TextArea } from '@radix-ui/themes';

interface DebounceTextAreaProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  rows?: number;
  debounceDelay?: number;
}

/**
 * A debounced textarea component that prevents re-rendering on each keystroke.
 * Uses internal state to manage the input value and debounces the onChange callback.
 */
const DebounceTextArea: React.FC<DebounceTextAreaProps> = ({
  value,
  onChange,
  placeholder,
  disabled = false,
  rows = 3,
  debounceDelay = 300,
}) => {
  // Internal state to manage the textarea value
  const [internalValue, setInternalValue] = useState(value);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const initializedRef = useRef(false);

  // Initialize internal value only once when component mounts
  useEffect(() => {
    if (!initializedRef.current) {
      setInternalValue(value);
      initializedRef.current = true;
    }
  }, [value]);

  // Update internal value only when external value changes significantly
  // (e.g., when loading different word data, not from our own debounced updates)
  useEffect(() => {
    if (initializedRef.current && value !== internalValue) {
      // Only update if the external value is significantly different
      // This prevents the conflict between internal typing and external updates
      const hasTimeout = timeoutRef.current !== null;
      if (!hasTimeout) {
        setInternalValue(value);
      }
    }
  }, [value, internalValue]);

  // Debounced onChange handler
  const debouncedOnChange = useCallback(
    (newValue: string) => {
      // Clear the previous timeout
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      // Set a new timeout
      timeoutRef.current = setTimeout(() => {
        onChange(newValue);
        timeoutRef.current = null;
      }, debounceDelay);
    },
    [onChange, debounceDelay]
  );

  // Handle internal value change
  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const newValue = e.target.value;
      setInternalValue(newValue);
      debouncedOnChange(newValue);
    },
    [debouncedOnChange]
  );

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return (
    <TextArea
      placeholder={placeholder}
      value={internalValue}
      onChange={handleChange}
      disabled={disabled}
      rows={rows}
    />
  );
};

export default DebounceTextArea;
