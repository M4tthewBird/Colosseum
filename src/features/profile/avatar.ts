import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { Image } from 'react-native';

import { isEmojiAvatar } from '@/lib/avatars';
import { isDemo, supabase } from '@/lib/supabase';

export interface PickedPhoto {
  uri: string;
  width: number;
  height: number;
}

/** Opens the photo library; null when cancelled. Our own PhotoCropper does the cropping. */
export async function pickImage(): Promise<PickedPhoto | null> {
  const res = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: false,
    quality: 1,
  });
  const asset = res.canceled ? null : res.assets[0];
  if (!asset) return null;
  if (asset.width && asset.height)
    return { uri: asset.uri, width: asset.width, height: asset.height };
  return new Promise((resolve, reject) =>
    Image.getSize(asset.uri, (width, height) => resolve({ uri: asset.uri, width, height }), reject),
  );
}

/** The chosen part of a photo, as a new local image. */
export async function cropPhoto(
  uri: string,
  area: { originX: number; originY: number; width: number; height: number },
): Promise<string> {
  const ctx = ImageManipulator.manipulate(uri);
  ctx.crop(area);
  const image = await ctx.renderAsync();
  const result = await image.saveAsync({ format: SaveFormat.JPEG, compress: 0.95 });
  return result.uri;
}

/**
 * Resizes to 512 px JPEG and uploads to avatars/<uid>/avatar.jpg. Returns the public URL. An
 * emoji avatar is kept as it is (nothing to upload).
 */
export async function uploadAvatar(userId: string, uri: string): Promise<string> {
  if (isEmojiAvatar(uri)) return uri;
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
