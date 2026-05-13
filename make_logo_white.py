from PIL import Image
import numpy as np

img = Image.open('Z:/Logos/nvo logo ECG SA fond blanc.jpg').convert('RGB')
arr = np.array(img, dtype=np.float32)

# Luminance calculee sur image originale
lum = 0.299 * arr[:,:,0] + 0.587 * arr[:,:,1] + 0.114 * arr[:,:,2]

# RGBA : tout blanc, alpha base sur inverse luminance
out = np.zeros((arr.shape[0], arr.shape[1], 4), dtype=np.uint8)
out[:,:,0] = 255
out[:,:,1] = 255
out[:,:,2] = 255
# Fond tres clair (>215) => transparent, Logo fonce (<100) => opaque
alpha = np.clip((200 - lum) / (200 - 50) * 255, 0, 255).astype(np.uint8)
out[:,:,3] = alpha

result = Image.fromarray(out, mode='RGBA')
result.save('frontend/public/logos/ecg-white.png')
print('min alpha:', alpha.min(), 'max alpha:', alpha.max())
print('pixels logo (lum<100):', int((lum < 100).sum()))
print('pixels fond (lum>215):', int((lum > 215).sum()))
print('Saved:', result.size)
