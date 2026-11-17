'use client';

import React, { useState } from 'react';
import { LEGAL_GLOSSARY, SHOP_ITEMS } from '@/lib/gameData';
import { purchaseShopItem } from '@/lib/scoring';
import {
  getDanishVoices,
  previewVoiceProfile,
  stopSpeaking,
  VOICE_PROFILE_OPTIONS,
} from '@/lib/audio';
import type {
  PlayableRole,
  PlayerProfile,
  ShopCategory,
  ShopItem,
  TtsEngine,
  VoiceProfileId,
} from '@/lib/types';

interface ShopGlossaryModalProps {
  open: boolean;
  initialTab: 'shop' | 'glossary' | 'settings';
  profile: PlayerProfile;
  onClose: () => void;
  onUpdateProfile: (next: PlayerProfile) => void;
  onRestartTutorial: () => void;
}

const CATEGORY_LABELS: { id: ShopCategory; label: string }[] = [
  { id: 'hat', label: 'Hatte & Parykker' },
  { id: 'outfit', label: 'Kapper & Tøj' },
  { id: 'color', label: 'Farver' },
  { id: 'animation', label: 'Animationer' },
  { id: 'courtroom', label: 'Retssalsdesign' },
];

export function ShopGlossaryModal({
  open,
  initialTab,
  profile,
  onClose,
  onUpdateProfile,
  onRestartTutorial,
}: ShopGlossaryModalProps) {
  const [tab, setTab] = useState<'shop' | 'glossary' | 'settings'>(initialTab);
  const [shopCat, setShopCat] = useState<ShopCategory>('hat');
  const [glossaryFilter, setGlossaryFilter] = useState('');
  const [shopNotice, setShopNotice] = useState<string | null>(null);
  const [walletInput, setWalletInput] = useState(profile.wallet.address ?? '');
  const [previewingTarget, setPreviewingTarget] = useState<'judge' | 'counsel' | null>(null);
  const [lastPreviewSample, setLastPreviewSample] = useState<string | null>(null);

  // Initialized cleanly per mount when modal opens

  if (!open) return null;

  const handleBuyOrEquip = (item: ShopItem) => {
    const res = purchaseShopItem(profile, item);
    if (!res.success) {
      setShopNotice(res.reason || 'Ikke nok credits.');
      return;
    }
    setShopNotice(
      profile.unlockedItemIds.includes(item.id)
        ? `Valgt: ${item.name}`
        : `Købt og udstyret: ${item.name}`
    );
    onUpdateProfile(res.profile);
  };

  const handleLinkWallet = (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = walletInput.trim();
    if (!cleaned || cleaned.length < 10) {
      setShopNotice('Indtast en gyldig wallet-adresse (f.eks. 0x...) for at forberede bro.');
      return;
    }
    onUpdateProfile({
      ...profile,
      wallet: {
        status: 'prepared',
        network: 'ethereum-sepolia-ready',
        address: cleaned,
        pendingCreditsBridge: profile.credits,
      },
    });
    setShopNotice('Wallet-struktur gemt og klargjort til fremtidig integration.');
  };

  const filteredTerms = LEGAL_GLOSSARY.filter(
    (t) =>
      t.term.toLowerCase().includes(glossaryFilter.toLowerCase()) ||
      t.shortDefinition.toLowerCase().includes(glossaryFilter.toLowerCase()) ||
      t.category.toLowerCase().includes(glossaryFilter.toLowerCase())
  );

  const voices = getDanishVoices();

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Shop, Juridisk Leksikon og Profil"
    >
      <div className="w-full max-w-4xl bg-[#F4EFE6] text-[#1C1917] border border-[#2A241E] rounded-[2px] flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-2 px-5 py-3.5 bg-[#1C1917] text-[#F4EFE6] border-b border-[#3D352B]">
          <div className="flex items-center gap-3">
            <h2 className="font-serif text-lg font-semibold">
              Retsspillers Profil, Shop & Juridisk Leksikon
            </h2>
            <span className="px-2 py-0.5 text-xs font-mono bg-[#2C251F] border border-[#A87C2D] text-[#E6C77E] rounded-[2px] tabular-nums">
              {profile.credits} Credits
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1 text-xs font-medium bg-[#2C251F] hover:bg-[#3A3129] border border-[#54483B] rounded-[2px] cursor-pointer"
          >
            Luk
          </button>
        </div>

        {/* Top Tabs */}
        <div className="flex border-b border-[#C8BCA8] bg-[#EAE3D5] px-4 pt-2 gap-2">
          {(
            [
              { id: 'shop', label: 'Økonomi & Shop' },
              { id: 'glossary', label: `Juridisk Leksikon (${LEGAL_GLOSSARY.length})` },
              { id: 'settings', label: 'Profil, TTS & Indstillinger' },
            ] as const
          ).map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`px-3.5 py-2 text-xs font-semibold border-t border-x rounded-t-[2px] cursor-pointer ${
                tab === t.id
                  ? 'bg-[#F4EFE6] border-[#C8BCA8] text-[#1C1917] -mb-px'
                  : 'bg-transparent border-transparent text-[#5A4F42] hover:text-[#1C1917]'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="p-5 overflow-y-auto court-scroll flex-1">
          {tab === 'shop' && (
            <div className="space-y-5">
              <div className="flex flex-wrap gap-1.5">
                {CATEGORY_LABELS.map((cat) => (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setShopCat(cat.id)}
                    className={`px-3 py-1.5 text-xs font-medium border rounded-[2px] cursor-pointer ${
                      shopCat === cat.id
                        ? 'bg-[#1C1917] text-[#F4EFE6] border-[#1C1917]'
                        : 'bg-[#FBF8F3] text-[#3D352B] border-[#C8BCA8] hover:border-[#1C1917]'
                    }`}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>

              {shopNotice && (
                <div className="px-3 py-2 text-xs bg-[#EAE3D5] border border-[#A87C2D] text-[#1C1917] rounded-[2px]">
                  {shopNotice}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {SHOP_ITEMS.filter((i) => i.category === shopCat).map((item) => {
                  const unlocked = profile.unlockedItemIds.includes(item.id);
                  const equipped = profile.equipped[item.category] === item.id;
                  return (
                    <div
                      key={item.id}
                      className={`p-3.5 border rounded-[2px] flex flex-col justify-between bg-[#FBF8F3] ${
                        equipped ? 'border-[#7C2D2D]' : 'border-[#C8BCA8]'
                      }`}
                    >
                      <div>
                        <div className="flex items-center justify-between gap-2">
                          <h3 className="font-serif font-bold text-sm">{item.name}</h3>
                          {item.previewHex && (
                            <span
                              className="w-4 h-4 border border-[#1C1917] rounded-[2px] shrink-0"
                              style={{ backgroundColor: item.previewHex }}
                            />
                          )}
                        </div>
                        <p className="text-xs text-[#4A4137] mt-1">{item.description}</p>
                      </div>
                      <div className="mt-3 pt-2.5 border-t border-[#E0D7C8] flex items-center justify-between">
                        <span className="text-xs font-mono font-semibold tabular-nums">
                          {unlocked ? 'Ejet' : `${item.price} Credits`}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleBuyOrEquip(item)}
                          disabled={equipped}
                          className={`px-3 py-1 text-xs font-semibold rounded-[2px] border cursor-pointer ${
                            equipped
                              ? 'bg-[#EAE3D5] text-[#5A4F42] border-[#C8BCA8] cursor-default'
                              : unlocked
                                ? 'bg-[#1C1917] text-[#F4EFE6] border-[#1C1917]'
                                : 'bg-[#7C2D2D] text-[#F4EFE6] border-[#5A1E1E]'
                          }`}
                        >
                          {equipped ? 'Udstyret' : unlocked ? 'Brug' : 'Køb'}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Prepared Wallet Structure */}
              <div className="p-4 border border-[#C8BCA8] bg-[#EAE3D5] rounded-[2px]">
                <h4 className="font-serif font-bold text-sm">
                  Forberedt Wallet-struktur (Fremtidig Web3/Krypto-bro)
                </h4>
                <p className="text-xs text-[#4A4137] mt-1">
                  Kontoens credits ({profile.credits}) er klar til fremtidig token-synkronisering.
                  Status:{' '}
                  <span className="font-mono font-semibold">
                    {profile.wallet.status === 'prepared'
                      ? `Forberedt (${profile.wallet.address})`
                      : 'Ikke tilknyttet'}
                  </span>
                </p>
                <form onSubmit={handleLinkWallet} className="mt-2.5 flex flex-wrap gap-2">
                  <input
                    type="text"
                    value={walletInput}
                    onChange={(e) => setWalletInput(e.target.value)}
                    placeholder="0x... (valgfri offentlig wallet-adresse)"
                    aria-label="Offentlig wallet-adresse"
                    className="flex-1 min-w-[220px] px-2.5 py-1.5 text-xs font-mono bg-[#FBF8F3] border border-[#9F927E] rounded-[2px]"
                  />
                  <button
                    type="submit"
                    className="px-3 py-1.5 text-xs font-semibold bg-[#1C1917] text-[#F4EFE6] rounded-[2px] cursor-pointer"
                  >
                    Gem wallet-struktur
                  </button>
                </form>
              </div>
            </div>
          )}

          {tab === 'glossary' && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <input
                  type="search"
                  value={glossaryFilter}
                  onChange={(e) => setGlossaryFilter(e.target.value)}
                  placeholder="Søg i juridiske termer (f.eks. bevisbyrde, habilitet, kontradiktion)..."
                  aria-label="Søg i juridisk leksikon"
                  className="w-full px-3 py-2 text-xs bg-[#FBF8F3] border border-[#9F927E] rounded-[2px]"
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {filteredTerms.map((term) => (
                  <div
                    key={term.id}
                    className="p-3.5 border border-[#C8BCA8] bg-[#FBF8F3] rounded-[2px]"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="font-serif font-bold text-base">{term.term}</h3>
                      <span className="text-[10px] font-mono uppercase px-1.5 py-0.5 bg-[#EAE3D5] border border-[#C8BCA8] rounded-[2px]">
                        {term.category}
                      </span>
                    </div>
                    <p className="text-xs text-[#2C2620] mt-1.5 leading-relaxed">
                      {term.shortDefinition}
                    </p>
                    <p className="text-[11px] text-[#5A4F42] mt-2 border-t border-[#E6DFD3] pt-1.5">
                      <strong className="font-semibold">I retten:</strong> {term.courtroomExample}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {tab === 'settings' && (
            <div className="space-y-4 max-w-xl">
              <div>
                <label className="block text-xs font-semibold mb-1" htmlFor="displayNameInput">
                  Spillernavn i retssalen
                </label>
                <input
                  id="displayNameInput"
                  type="text"
                  value={profile.displayName}
                  onChange={(e) =>
                    onUpdateProfile({ ...profile, displayName: e.target.value })
                  }
                  className="w-full px-3 py-1.5 text-xs bg-[#FBF8F3] border border-[#9F927E] rounded-[2px]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1" htmlFor="preferredRoleSelect">
                  Foretrukken standardrolle (gemmes)
                </label>
                <select
                  id="preferredRoleSelect"
                  value={profile.preferredRole}
                  onChange={(e) =>
                    onUpdateProfile({
                      ...profile,
                      preferredRole: e.target.value as PlayableRole,
                    })
                  }
                  className="w-full px-3 py-1.5 text-xs bg-[#FBF8F3] border border-[#9F927E] rounded-[2px]"
                >
                  <option value="Anklager">Anklager</option>
                  <option value="Forsvarer">Forsvarer</option>
                  <option value="Tiltalte">Den Tiltalte</option>
                  <option value="Vidne">Vidne</option>
                  <option value="Dommer">Dommer</option>
                </select>
              </div>

              <div
                data-testid="voice-settings-section"
                className="p-3.5 border border-[#C8BCA8] bg-[#FBF8F3] rounded-[2px] space-y-3"
              >
                <div className="flex items-center justify-between border-b border-[#E5DEC9] pb-2">
                  <div>
                    <h3 className="font-serif font-bold text-sm text-[#1C1917]">
                      Voice Settings · Stemmeindstillinger
                    </h3>
                    <p className="text-[11px] text-[#5A4F42]">
                      Vælg stemmeprofiler for Dommer og Modpart, og hør en tilfældig taleprøve.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      const next = !profile.ttsEnabled;
                      if (!next) stopSpeaking();
                      onUpdateProfile({ ...profile, ttsEnabled: next });
                    }}
                    className={`px-3 py-1 text-xs font-mono border rounded-[2px] cursor-pointer ${
                      profile.ttsEnabled
                        ? 'bg-[#1C1917] text-[#F4EFE6] border-[#1C1917]'
                        : 'bg-[#EAE3D5] text-[#4A4137] border-[#C8BCA8]'
                    }`}
                  >
                    Live TTS: {profile.ttsEnabled ? 'TIL' : 'FRA'}
                  </button>
                </div>

                <div>
                  <label className="block text-xs font-semibold mb-1" htmlFor="ttsEngineSelect">
                    Stemme-motor (Lav latenstid)
                  </label>
                  <select
                    id="ttsEngineSelect"
                    value={profile.ttsEngine}
                    onChange={(e) =>
                      onUpdateProfile({
                        ...profile,
                        ttsEngine: e.target.value as TtsEngine,
                      })
                    }
                    className="w-full px-3 py-1.5 text-xs bg-[#EAE3D5] border border-[#9F927E] rounded-[2px]"
                  >
                    <option value="browser">Hurtig Browser-TTS (Øjeblikkelig, 0 ms)</option>
                    <option value="gemini">
                      Gemini AI-Stemmer (gemini-3.8-flash-lite-tts)
                    </option>
                  </select>
                </div>

                <div className="grid grid-cols-1 gap-2.5 pt-1 border-t border-[#E5DEC9]">
                  <div>
                    <label
                      className="block text-xs font-semibold mb-1"
                      htmlFor="judgeVoiceSelect"
                    >
                      Dommerens stemmeprofil
                    </label>
                    <div className="flex gap-2">
                      <select
                        id="judgeVoiceSelect"
                        data-testid="judge-voice-select"
                        value={profile.judgeVoiceProfile}
                        onChange={(e) =>
                          onUpdateProfile({
                            ...profile,
                            judgeVoiceProfile: e.target.value as VoiceProfileId,
                          })
                        }
                        className="flex-1 px-2.5 py-1.5 text-xs bg-[#EAE3D5] border border-[#9F927E] rounded-[2px]"
                      >
                        {VOICE_PROFILE_OPTIONS.map((v) => (
                          <option key={v.id} value={v.id}>
                            {v.label}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        data-testid="preview-judge-voice"
                        onClick={() => {
                          setPreviewingTarget('judge');
                          const sample = previewVoiceProfile(
                            profile.judgeVoiceProfile,
                            'judge',
                            profile.ttsEngine,
                            profile.ttsRate,
                            { onEnd: () => setPreviewingTarget(null) }
                          );
                          setLastPreviewSample(`Dommer (${profile.judgeVoiceProfile}): "${sample}"`);
                        }}
                        className="px-3 py-1.5 text-xs font-semibold bg-[#1C1917] text-[#F4EFE6] rounded-[2px] cursor-pointer shrink-0"
                      >
                        {previewingTarget === 'judge' ? 'Afspiller...' : 'Hør prøve'}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label
                      className="block text-xs font-semibold mb-1"
                      htmlFor="counselVoiceSelect"
                    >
                      Modpartens / Advokatens stemmeprofil
                    </label>
                    <div className="flex gap-2">
                      <select
                        id="counselVoiceSelect"
                        data-testid="counsel-voice-select"
                        value={profile.counselVoiceProfile}
                        onChange={(e) =>
                          onUpdateProfile({
                            ...profile,
                            counselVoiceProfile: e.target.value as VoiceProfileId,
                          })
                        }
                        className="flex-1 px-2.5 py-1.5 text-xs bg-[#EAE3D5] border border-[#9F927E] rounded-[2px]"
                      >
                        {VOICE_PROFILE_OPTIONS.map((v) => (
                          <option key={v.id} value={v.id}>
                            {v.label}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        data-testid="preview-counsel-voice"
                        onClick={() => {
                          setPreviewingTarget('counsel');
                          const sample = previewVoiceProfile(
                            profile.counselVoiceProfile,
                            'counsel',
                            profile.ttsEngine,
                            profile.ttsRate,
                            { onEnd: () => setPreviewingTarget(null) }
                          );
                          setLastPreviewSample(`Modpart (${profile.counselVoiceProfile}): "${sample}"`);
                        }}
                        className="px-3 py-1.5 text-xs font-semibold bg-[#7C2D2D] text-[#F4EFE6] rounded-[2px] cursor-pointer shrink-0"
                      >
                        {previewingTarget === 'counsel' ? 'Afspiller...' : 'Hør prøve'}
                      </button>
                    </div>
                  </div>
                </div>

                {lastPreviewSample && (
                  <div
                    data-testid="voice-preview-sample"
                    className="px-2.5 py-1.5 text-[11px] bg-[#EAE3D5] border border-[#C8BCA8] text-[#1C1917] rounded-[2px]"
                  >
                    {lastPreviewSample}
                  </div>
                )}

                <div>
                  <label className="block text-xs text-[#4A4137] mb-1" htmlFor="ttsRateRange">
                    Talehastighed ({profile.ttsRate.toFixed(1)}x)
                  </label>
                  <input
                    id="ttsRateRange"
                    type="range"
                    min="0.7"
                    max="1.4"
                    step="0.1"
                    value={profile.ttsRate}
                    onChange={(e) =>
                      onUpdateProfile({ ...profile, ttsRate: Number(e.target.value) })
                    }
                    className="w-full"
                  />
                </div>
                <p className="text-[11px] text-[#5A4F42]">
                  Danske/system-stemmer fundet lokalt: {voices.length}
                </p>
              </div>

              <div className="pt-2 border-t border-[#C8BCA8] flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onRestartTutorial();
                  }}
                  className="px-3.5 py-2 text-xs font-semibold bg-[#7C2D2D] text-[#F4EFE6] border border-[#5A1E1E] rounded-[2px] cursor-pointer"
                >
                  Genstart Tutorial (Sag #0001)
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
