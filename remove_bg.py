from PIL import Image
import numpy as np

# Load the logo image
img = Image.open('/home/ubuntu/bseva-website/client/public/bseva-logo.png')
img = img.convert('RGBA')

# Get the image data as numpy array
data = np.array(img)

# The background is white/near-white, so we'll make those pixels transparent
# Define threshold for white (RGB values close to 255)
threshold = 240

# Create a mask for white/near-white pixels
white_mask = (data[:, :, 0] > threshold) & (data[:, :, 1] > threshold) & (data[:, :, 2] > threshold)

# Set alpha channel to 0 for white pixels
data[:, :, 3] = np.where(white_mask, 0, 255)

# Create new image with transparency
result = Image.fromarray(data)

# Save the result
result.save('/home/ubuntu/bseva-website/client/public/bseva-logo.png')
print("Logo background removed successfully!")
