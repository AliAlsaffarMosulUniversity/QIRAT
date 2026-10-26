// Private channel registry and delivery ledger. Tokens never leave the worker.
export const TEST_TEXT = 'اختبار تقني لنظام قيراط – ليس إعلان وفاة حقيقياً';
const uuid = value => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value || '');
export const channelId = value => typeof value === 'string' && /^-100[1-9][0-9]{5,15}$/.test(value) && Number.isSafeInteger(Number(value));
export class ChannelError extends Error {
  constructor(code, status = 400) { super(code); this.status = status; }
}
export async function checkChannel(env, chatId, api) {
  if (!channelId(chatId)) throw new ChannelError('numeric_channel_id_required');
  if (!/^\d+$/.test(env.TELEGRAM_ADMIN_ID || '')) throw new ChannelError('telegram_admin_required', 503);
  const me = await api('getMe', {});
  if (me.username?.toLowerCase() !== 'qiratmosulalertsbot') throw new ChannelError('wrong_bot', 503);
  const chat = await api('getChat', { chat_id: chatId });
  if (chat.type !== 'channel' || String(chat.id) !== chatId) throw new ChannelError('channel_required');
  const owner = await api('getChatMember', { chat_id: chatId, user_id: Number(env.TELEGRAM_ADMIN_ID) });
  if (!['creator', 'administrator'].includes(owner.status)) throw new ChannelError('channel_admin_required', 403);
  const bot = await api('getChatMember', { chat_id: chatId, user_id: me.id });
  if (bot.status !== 'administrator' || !bot.can_post_messages || !bot.can_edit_messages || !bot.can_delete_messages)
    throw new ChannelError('bot_permissions_required', 403);
  return { chat_id: chatId, title: String(chat.title || '').slice(0, 200), checkedAt: Date.now() };
}
export async function rememberChannel(update, env, store) {
  // Membership updates are hints, never authorization to publish.
  const change = update.my_chat_member;
  const forward = update.message?.chat?.type === 'private' && String(update.message.from?.id) === String(env.TELEGRAM_ADMIN_ID)
    ? update.message.forward_origin : null;
  const chat = change?.chat || (forward?.type === 'channel' ? forward.chat : null);
  if (chat?.type !== 'channel' || !channelId(String(chat.id))) return false;
  const path = '_qiratTelegramCandidates/' + chat.id, previous = await store.get(path);
  const data = { chat_id: String(chat.id), title: String(chat.title || '').slice(0, 200), observedAt: Date.now() };
  if (!await store.commit([store.put(path, data, previous)])) throw new ChannelError('conflict', 409);
  return true;
}
const labels = { fajr: 'الفجر', dhuhr: 'الظهر', asr: 'العصر', maghrib: 'المغرب', isha: 'العشاء' };
export function announcementText(a, env) {
  const text = ['قيراط — إعلان صلاة جنازة', a.name, 'الجامع: ' + a.mosque,
    [a.city, a.area].filter(Boolean).join(' — '), String(a.datetime || '').slice(0, 10) + ' — صلاة ' + (labels[a.prayer] || 'غير محددة'),
    a.cemetery ? 'المقبرة: ' + a.cemetery : '', a.notes || '', a.map || '',
    (env.APP_URL || 'https://alialsaffarmosuluniversity.github.io/QIRAT/').split('#')[0] + '#announcement=' + a.id].filter(Boolean).join('\n');
  if (text.length > 4096) throw new ChannelError('message_too_long');
  return text;
}
export async function validatePhoto(photo) {
  if (!(photo instanceof Blob) || !photo.size || photo.size > 5*1024*1024) throw new ChannelError('invalid_photo');
  const bytes = new Uint8Array(await photo.slice(0,12).arrayBuffer());
  const jpeg = bytes[0]===255 && bytes[1]===216 && bytes[2]===255;
  const png = [137,80,78,71,13,10,26,10].every((v,i)=>bytes[i]===v);
  const webp = String.fromCharCode(...bytes.slice(0,4))==='RIFF' && String.fromCharCode(...bytes.slice(8,12))==='WEBP';
  if (!jpeg && !png && !webp) throw new ChannelError('invalid_photo');
  return new Blob([photo],{type:jpeg?'image/jpeg':png?'image/png':'image/webp'});
}
export async function channelAction(body, env, store, api) {
  const action = body.action;
  const settingsPath='_qiratTelegramSettings/publishing';
  if (action === 'list') return { channels: await store.list('_qiratTelegramChannels'), candidates: await store.list('_qiratTelegramCandidates'), default_chat_id:(await store.get(settingsPath))?.data.chat_id || '' };
  const id = body.chat_id;
  if (!channelId(id)) throw new ChannelError('numeric_channel_id_required');
  const channelPath = '_qiratTelegramChannels/' + id;
  const channel = await store.get(channelPath);
  if (action === 'connect' || action === 'verify') {
    const verified = await checkChannel(env, id, api);
    const data = { ...verified, enabled: channel?.data.enabled ?? true };
    const settings=await store.get(settingsPath), writes=[store.put(channelPath,data,channel)];
    if (!settings) writes.push(store.put(settingsPath,{chat_id:id},null));
    if (!await store.commit(writes)) throw new ChannelError('conflict', 409);
    return { channel: data };
  }
  if (!channel) throw new ChannelError('channel_not_connected', 404);
  if (action === 'set-default') {
    if (!channel.data.enabled) throw new ChannelError('channel_disabled',409);
    await checkChannel(env,id,api);
    const settings=await store.get(settingsPath);
    if (!await store.commit([store.put(settingsPath,{chat_id:id},settings)])) throw new ChannelError('conflict',409);
    return {default_chat_id:id};
  }
  if (action === 'deliveries') return { deliveries: await store.list(channelPath + '/deliveries') };
  if (action === 'toggle') {
    if (typeof body.enabled !== 'boolean') throw new ChannelError('invalid_request');
    if (body.enabled) await checkChannel(env, id, api);
    const data = { ...channel.data, enabled: body.enabled };
    if (!await store.commit([store.put(channelPath, data, channel)])) throw new ChannelError('conflict', 409);
    return { channel: data };
  }
  if (!['publish', 'edit', 'delete', 'test-publish', 'test-edit', 'test-delete','compose-publish','compose-edit','compose-delete'].includes(action)) throw new ChannelError('invalid_action');
  const test = action.startsWith('test-'), compose=action.startsWith('compose-'), operation = action.replace(/^(test-|compose-)/, '');
  const kind=test?'test':compose?'compose':'announcement';
  const deliveryId = body.delivery_id;
  if (!uuid(deliveryId)) throw new ChannelError('delivery_id_required');
  const path = channelPath + '/deliveries/' + deliveryId;
  const previous = await store.get(path);
  if (previous && (previous.data.kind || (previous.data.test?'test':'announcement')) !== kind) throw new ChannelError('delivery_type_mismatch');
  if (operation === 'publish' && previous) {
    if (previous.data.state === 'sent' || previous.data.state === 'deleted') return { delivery: previous.data };
    throw new ChannelError('delivery_pending_review', 409);
  }
  if (operation !== 'publish' && (!previous || previous.data.state !== 'sent' || !Number.isSafeInteger(previous.data.message_id) || previous.data.message_id <= 0))
    throw new ChannelError('saved_message_required', 409);
  if (operation === 'publish' && !channel.data.enabled) throw new ChannelError('channel_disabled', 409);
  let text = TEST_TEXT;
  let photo=null;
  if (compose && operation!=='delete') {
    if(typeof body.text!=='string'||!body.text.trim()) throw new ChannelError('text_required');
    text=body.text.trim();
    if(body.photo){
      if(operation==='edit'&&previous.data.mediaType!=='photo')throw new ChannelError('photo_edit_not_supported');
      photo=await validatePhoto(body.photo);
    }
    const max=photo||previous?.data.mediaType==='photo'?1024:4096;
    if(text.length>max)throw new ChannelError(max===1024?'caption_too_long':'message_too_long');
  }
  if (test && operation === 'edit') text += '\nتم تعديل رسالة الاختبار التقني.';
  if (!test && !compose && operation !== 'delete') {
    // The announcement UUID is also the delivery ID: one post per announcement/channel.
    const announcement = await store.get('announcements/' + deliveryId);
    if (!announcement || announcement.data.status !== 'published') throw new ChannelError('announcement_not_found', 404);
    text = announcementText(announcement.data, env);
  }
  await checkChannel(env, id, api);
  if (operation === 'edit' && previous.data.text === text && !photo) return { delivery: previous.data };
  const mediaType=photo?'photo':previous?.data.mediaType||'text';
  const pending = { ...(previous?.data || {}), delivery_id: deliveryId, chat_id: id, test,kind,mediaType,
    announcementId: test||compose ? null : deliveryId, state: 'pending', operation, attemptedAt: Date.now() };
  // Claim before calling Telegram. A timeout/crash is deliberately NOT retried automatically.
  if (!await store.commit([store.put(path, pending, previous)])) throw new ChannelError('conflict', 409);
  let result;
  try {
    const message = { chat_id: id, ...(operation !== 'publish' ? { message_id: previous.data.message_id } : {}),
      ...(operation !== 'delete' ? mediaType==='photo'?(photo&&operation==='edit'?{photo,media:JSON.stringify({type:'photo',media:'attach://photo',caption:text})}:{caption:text,...(photo?{photo}:{})}):{ text, link_preview_options: { is_disabled: true } } : {}) };
    const method=operation==='delete'?'deleteMessage':operation==='publish'?(photo?'sendPhoto':'sendMessage'):(photo?'editMessageMedia':mediaType==='photo'?'editMessageCaption':'editMessageText');
    result = await api(method, message);
  } catch {
    throw new ChannelError('delivery_pending_review', 409);
  }
  const messageId = operation === 'publish' ? result?.message_id : previous.data.message_id;
  if (operation === 'delete' && result !== true) throw new ChannelError('delivery_pending_review', 409);
  if (!Number.isSafeInteger(messageId) || messageId <= 0 || (operation === 'publish' && String(result?.chat?.id) !== id))
    throw new ChannelError('delivery_pending_review', 409);
  const saved = await store.get(path);
  const delivery = { ...pending, message_id: messageId, state: operation === 'delete' ? 'deleted' : 'sent', updatedAt: Date.now(),
    ...(photo&&result.photo?.length?{photo_file_id:result.photo.at(-1).file_id}:{}),
    ...(operation !== 'delete' ? { text } : {}) };
  if (!saved || !await store.commit([store.put(path, delivery, saved)])) throw new ChannelError('delivery_pending_review', 409);
  return { delivery };
}
