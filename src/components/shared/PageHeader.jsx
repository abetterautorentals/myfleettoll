import React from 'react';

export default function PageHeader({ emoji, title, subtitle, action }) {
  return (
    <div className="flex items-center justify-between p-4 pt-6">
      <div>
        <h1 className="text-2xl font-black flex items-center gap-2">
          <span className="text-3xl">{emoji}</span>
          {title}
        </h1>
        {subtitle && <p className="text-sm text-muted-foreground/90 font-medium mt-0.5">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}