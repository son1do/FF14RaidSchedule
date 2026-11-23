import { useState, useRef, useEffect, useMemo } from 'react';
import { getOrderedJobGroups } from '../utils/jobs.js';

export default function JobCombobox({
  value,
  onChange,
  roleGroup,
  placeholder = 'ジョブを選択または手入力',
  maxLength = 24,
  openUpward = false,
}) {
  const [open, setOpen] = useState(false);
  const [filtering, setFiltering] = useState(false);
  const wrapRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const handleOutside = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) {
        setOpen(false);
        setFiltering(false);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [open]);

  const orderedGroups = useMemo(() => getOrderedJobGroups(roleGroup), [roleGroup]);

  const filteredGroups = useMemo(() => {
    const query = filtering ? value.trim().toLowerCase() : '';
    if (!query) return orderedGroups;
    return orderedGroups
      .map((group) => ({
        ...group,
        jobs: group.jobs.filter((job) => job.toLowerCase().includes(query)),
      }))
      .filter((group) => group.jobs.length > 0);
  }, [orderedGroups, value, filtering]);

  const handleInputChange = (e) => {
    onChange(e.target.value);
    setOpen(true);
    setFiltering(true);
  };

  const handleFocus = () => {
    setOpen(true);
    setFiltering(false);
  };

  const handleToggle = () => {
    if (open) {
      setOpen(false);
      setFiltering(false);
    } else {
      setOpen(true);
      setFiltering(false);
      inputRef.current?.focus();
    }
  };

  const handleSelect = (job) => {
    onChange(job);
    setOpen(false);
    setFiltering(false);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Escape' && open) {
      e.stopPropagation();
      setOpen(false);
      setFiltering(false);
    }
  };

  return (
    <div className="job-combobox" ref={wrapRef}>
      <div className="job-combobox-input-wrap">
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={handleInputChange}
          onFocus={handleFocus}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          maxLength={maxLength}
          autoComplete="off"
        />
        <button
          type="button"
          className={`job-combobox-toggle ${open ? 'open' : ''}`}
          onClick={handleToggle}
          tabIndex={-1}
          aria-label="ジョブ候補を開く"
        >
          ▾
        </button>
      </div>

      {open && (
        <div
          className={`job-dropdown ${openUpward ? 'job-dropdown-up' : ''}`}
          role="listbox"
        >
          {filteredGroups.length > 0 ? (
            filteredGroups.map((group) => (
              <div key={group.id} className="job-group">
                <div className={`job-group-label job-group-${group.roleGroup}`}>
                  {group.label}
                </div>
                <div className="job-group-options">
                  {group.jobs.map((job) => (
                    <button
                      key={job}
                      type="button"
                      role="option"
                      aria-selected={value === job}
                      className={`job-option ${value === job ? 'selected' : ''}`}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        handleSelect(job);
                      }}
                    >
                      {job}
                    </button>
                  ))}
                </div>
              </div>
            ))
          ) : (
            <div className="job-dropdown-empty">
              候補に一致しません（このまま「{value.trim()}」として手入力できます）
            </div>
          )}
        </div>
      )}
    </div>
  );
}
