"use client";

export function Toast({ message, type, onClose, isVisible }) {
  if (!isVisible) return null;
  
  return (
    <div
      className={`fixed px-4 py-2 rounded shadow text-white z-[100000000000] transition-all 
        ${
          type === "success"
            ? "bg-green-500 bottom-5 left-1/2 -translate-x-1/2"
            : "bg-red-500 top-12 left-1/2 -translate-x-1/2"
        }`}
    >
      {message}
      <button className="ml-2 font-bold" onClick={onClose}>
        &times;
      </button>
    </div>
  );
}