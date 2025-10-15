BEGIN;

-- Create the image-uploads bucket for load_image tool
INSERT INTO storage.buckets (id, name, public, allowed_mime_types, file_size_limit)
VALUES (
    'image-uploads',
    'image-uploads', 
    true,
    ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml']::text[],
    10485760  -- 10MB limit
)
ON CONFLICT (id) DO NOTHING;

-- Create the browser-screenshots bucket (referenced in code but missing)
INSERT INTO storage.buckets (id, name, public, allowed_mime_types, file_size_limit)
VALUES (
    'browser-screenshots',
    'browser-screenshots', 
    true,
    ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp']::text[],
    5242880  -- 5MB limit
)
ON CONFLICT (id) DO NOTHING;

-- RLS policies for image-uploads bucket
DROP POLICY IF EXISTS "Image uploads are publicly readable" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload images" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own image uploads" ON storage.objects;

CREATE POLICY "Image uploads are publicly readable" ON storage.objects
FOR SELECT USING (bucket_id = 'image-uploads');

CREATE POLICY "Authenticated users can upload images" ON storage.objects
FOR INSERT WITH CHECK (
    bucket_id = 'image-uploads' 
    AND auth.role() = 'authenticated'
);

CREATE POLICY "Users can delete their own image uploads" ON storage.objects
FOR DELETE USING (
    bucket_id = 'image-uploads' 
    AND auth.role() = 'authenticated'
);

-- RLS policies for browser-screenshots bucket
DROP POLICY IF EXISTS "Browser screenshots are publicly readable" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload browser screenshots" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own browser screenshots" ON storage.objects;

CREATE POLICY "Browser screenshots are publicly readable" ON storage.objects
FOR SELECT USING (bucket_id = 'browser-screenshots');

CREATE POLICY "Authenticated users can upload browser screenshots" ON storage.objects
FOR INSERT WITH CHECK (
    bucket_id = 'browser-screenshots' 
    AND auth.role() = 'authenticated'
);

CREATE POLICY "Users can delete their own browser screenshots" ON storage.objects
FOR DELETE USING (
    bucket_id = 'browser-screenshots' 
    AND auth.role() = 'authenticated'
);

COMMIT;
