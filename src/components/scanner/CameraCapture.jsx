import React, { useRef } from 'react';
import { Camera } from 'lucide-react';

export default function CameraCapture({ onCapture }) {
  const inputRef = useRef(null);

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Reset input so same photo can be retaken
    e.target.value = '';

    const reader = new FileReader();
    reader.onload = (evt) => {
      const dataUrl = evt.target.result;

      const img = new Image();
      img.onload = () => {
        const targetWidth = Math.min(img.width, 1200);
        const targetHeight = Math.round((img.height / img.width) * targetWidth);
        const canvas = document.createElement('canvas');
        canvas.width = targetWidth;
        canvas.height = targetHeight;
        const ctx = canvas.getContext('2d');

        // Draw image
        ctx.drawImage(img, 0, 0, targetWidth, targetHeight);

        // Apply grayscale + contrast enhancement for cleaner document scans
        const imageData = ctx.getImageData(0, 0, targetWidth, targetHeight);
        const data = imageData.data;
        const contrast = 1.4; // boost contrast
        const intercept = 128 * (1 - contrast);
        for (let i = 0; i < data.length; i += 4) {
          // Grayscale
          const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
          // Contrast
          const enhanced = Math.min(255, Math.max(0, contrast * gray + intercept));
          data[i] = enhanced;
          data[i + 1] = enhanced;
          data[i + 2] = enhanced;
        }
        ctx.putImageData(imageData, 0, 0);

        canvas.toBlob(
          (blob) => {
            const r = new FileReader();
            r.onload = (ev) => onCapture(ev.target.result);
            r.readAsDataURL(blob);
          },
          'image/jpeg',
          0.80
        );
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="flex flex-col items-center justify-center h-full bg-black p-8 gap-6">
      {/* Hidden native file input */}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleFileChange}
      />

      <div className="text-center">
        <div className="w-24 h-24 rounded-full bg-primary/20 border-4 border-primary/40 flex items-center justify-center mx-auto mb-4">
          <Camera className="w-12 h-12 text-primary" />
        </div>
        <p className="text-white font-bold text-lg">Tap to take a photo</p>
        <p className="text-white/60 text-sm mt-1">Opens your camera directly</p>
      </div>

      <button
        onClick={() => inputRef.current?.click()}
        className="w-full max-w-xs h-16 rounded-2xl bg-primary font-black text-white text-lg flex items-center justify-center gap-3 shadow-lg active:scale-95 transition-transform"
      >
        <Camera className="w-6 h-6" />
        Take Photo
      </button>
    </div>
  );
}