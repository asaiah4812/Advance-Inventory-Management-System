import os
import django
from django.core.files.storage import default_storage
from django.core.files import File
from pathlib import Path

# Setup Django environment
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'project.settings')
django.setup()

def upload_local_media():
    base_dir = Path(__file__).resolve().parent
    media_dir = base_dir / 'media'
    
    if not media_dir.exists():
        print(f"Local media directory not found at: {media_dir}")
        return

    print("Starting media upload to Cloudinary...")
    
    # Walk through the media directory
    uploaded_count = 0
    skipped_count = 0
    failed_count = 0
    
    for root, dirs, files in os.walk(media_dir):
        for file in files:
            local_path = Path(root) / file
            # Get path relative to the media folder (e.g., 'products/image.jpg')
            relative_path = str(local_path.relative_to(media_dir)).replace('\\', '/')
            
            print(f"Processing: {relative_path}...")
            
            try:
                # Check if file already exists on Cloudinary to prevent duplicates
                if default_storage.exists(relative_path):
                    print(f"  -> Already exists on Cloudinary: {relative_path}")
                    skipped_count += 1
                else:
                    with open(local_path, 'rb') as f:
                        django_file = File(f)
                        default_storage.save(relative_path, django_file)
                    print(f"  -> Successfully uploaded: {relative_path}")
                    uploaded_count += 1
            except Exception as e:
                print(f"  [ERROR] Failed to upload {relative_path}: {e}")
                failed_count += 1

    print("\nUpload session finished.")
    print(f"Uploaded: {uploaded_count} | Skipped: {skipped_count} | Failed: {failed_count}")

if __name__ == '__main__':
    upload_local_media()
