import { useEffect, useRef, useState } from 'react';

interface EditableTextProps {
  value: string;
  onCommit: (value: string) => void;
  /** 展示态样式 */
  className?: string;
  /** 编辑态 input 样式 */
  inputClassName?: string;
  placeholder?: string;
}

/** 点击即编辑的文本：Enter/失焦提交，Esc 取消 */
export default function EditableText({
  value,
  onCommit,
  className = '',
  inputClassName = '',
  placeholder,
}: EditableTextProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);
  // Safari 等浏览器在输入框被移除时也会派发 blur，用它区分“取消后的 blur”
  const cancelledRef = useRef(false);

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editing]);

  useEffect(() => {
    if (!editing) setDraft(value);
  }, [value, editing]);

  const commit = () => {
    setEditing(false);
    const trimmed = draft.trim();
    if (trimmed && trimmed !== value) {
      onCommit(trimmed);
    } else {
      setDraft(value);
    }
  };

  const cancel = () => {
    cancelledRef.current = true;
    setDraft(value);
    setEditing(false);
  };

  if (!editing) {
    return (
      <span
        className={`cursor-text ${className}`}
        title="点击编辑"
        onClick={(event) => {
          event.stopPropagation();
          setEditing(true);
        }}
      >
        {value}
      </span>
    );
  }

  return (
    <input
      ref={inputRef}
      className={inputClassName}
      value={draft}
      placeholder={placeholder}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={() => {
        if (cancelledRef.current) {
          cancelledRef.current = false;
          return;
        }
        commit();
      }}
      onClick={(event) => event.stopPropagation()}
      onPointerDown={(event) => event.stopPropagation()}
      onKeyDown={(event) => {
        if (event.key === 'Enter') {
          event.preventDefault();
          commit();
        } else if (event.key === 'Escape') {
          event.preventDefault();
          cancel();
        }
      }}
    />
  );
}
