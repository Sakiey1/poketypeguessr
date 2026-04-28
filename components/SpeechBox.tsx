import type { ReactNode } from "react";

type SpeechBoxProps = {
  children: ReactNode;
  className?: string;
};

export function SpeechBox({ children, className = "" }: SpeechBoxProps) {
  return (
    <div className={`relative border-4 border-black bg-white p-4 ${className}`}>
      {children}
      <div className="absolute -bottom-3 right-8 w-0 h-0 border-l-[10px] border-l-transparent border-r-[10px] border-r-transparent border-t-[12px] border-t-black" />
      <div className="absolute -bottom-[9px] right-[34px] w-0 h-0 border-l-[8px] border-l-transparent border-r-[8px] border-r-transparent border-t-[10px] border-t-white" />
    </div>
  );
}
