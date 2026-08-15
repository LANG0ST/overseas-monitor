import type { SupabaseClient } from "@supabase/supabase-js";

const MAX_IMAGE_SIZE = 5 * 1024 * 1024;

export async function uploadImage(
  supabase: SupabaseClient,
  bucket: string,
  file: FormDataEntryValue | null
) {
  if (!(file instanceof File) || file.size === 0) return null;
  if (!file.type.startsWith("image/") || file.size > MAX_IMAGE_SIZE) {
    throw new Error("Image invalide : format non supporté ou fichier supérieur à 5 Mo.");
  }

  const extension = file.name.split(".").pop()?.toLowerCase() || "jpg";
  const path = `${crypto.randomUUID()}.${extension}`;
  const { error } = await supabase.storage.from(bucket).upload(path, file, {
    contentType: file.type,
    upsert: false,
  });

  if (error) throw new Error(error.message);
  return path;
}

export async function signedImageUrl(
  supabase: SupabaseClient,
  bucket: string,
  path: string | null
) {
  if (!path) return null;
  const { data } = await supabase.storage.from(bucket).createSignedUrl(path, 3600);
  return data?.signedUrl ?? null;
}
