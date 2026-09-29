import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';

import { isDemo, supabase } from '@/lib/supabase';

/** Opens the photo library; returns a local uri or null when cancelled. */
export async function pickImage(): Promise<string | null> {
  const res = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: true,
    aspect: [1, 1],
    quality: 1,
  });
  if (res.canceled || !res.assets[0]) return null;
  return res.assets[0].uri;
}

/** Resizes to 512 px JPEG and uploads to avatars/<uid>/avatar.jpg. Returns the public URL. */
export async function uploadAvatar(userId: string, uri: string): Promise<string> {
  const ctx = ImageManipulator.manipulate(uri);
  ctx.resize({ width: 512 });
  const image = await ctx.renderAsync();
  const result = await image.saveAsync({ format: SaveFormat.JPEG, compress: 0.8 });
  if (isDemo) return result.uri;
  const body = await (await fetch(result.uri)).arrayBuffer();
  const path = `${userId}/avatar.jpg`;
  const { error } = await supabase.storage
    .from('avatars')
    .upload(path, body, { contentType: 'image/jpeg', upsert: true });
  if (error) throw new Error(error.message);
  const { data } = supabase.storage.from('avatars').getPublicUrl(path);
  return `${data.publicUrl}?v=${Date.now()}`;
}
