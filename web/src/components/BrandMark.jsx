import React from 'react';

export default function BrandMark({ className = '' }) {
  return (
    <svg
      className={className}
      viewBox="0 0 64 64"
      fill="none"
      aria-hidden="true"
      focusable="false"
    >
      <path
        d="M11 22v-6a4 4 0 0 1 4-4h6m22 0h6a4 4 0 0 1 4 4v6M11 42v6a4 4 0 0 0 4 4h6m22 0h6a4 4 0 0 0 4-4v-6"
        stroke="#D99A00"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2.5"
      />
      <path d="M23 10h13l9 9v31a3 3 0 0 1-3 3H22a3 3 0 0 1-3-3V13a3 3 0 0 1 3-3Z" fill="#F7F9FF" stroke="#A8B9D7" strokeWidth="1.2" />
      <path d="M36 10v7a2 2 0 0 0 2 2h7" fill="#DCE7F5" stroke="#A8B9D7" strokeLinejoin="round" strokeWidth="1.5" />
      <rect x="24" y="24" width="11" height="11" rx="2.5" fill="#FFB700" />
      <path d="m26.5 29.5 2 2 4-4.5" stroke="#0B1736" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2" />
      <path d="M23 39h21" stroke="#35BFCB" strokeLinecap="round" strokeWidth="2.5" />
      <path d="M25 45h13m-13 4h10" stroke="#52688F" strokeLinecap="round" strokeWidth="1.8" />
    </svg>
  );
}