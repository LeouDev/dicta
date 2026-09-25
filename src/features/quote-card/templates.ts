import { GRADIENTS } from './palettes';
import { DESIGN_VERSION, type QuoteDesign, type TemplateId } from './types';

type TemplateStyle = Omit<QuoteDesign, 'version' | 'template' | 'format' | 'signature'>;

export interface TemplateInfo {
  label: string;
  style: TemplateStyle;
}

const PROFILE_FULL = { showProfile: true, showAvatar: true, showUsername: true, showVerifiedBadge: true } as const;

export const TEMPLATES: Record<TemplateId, TemplateInfo> = {
  // Benchmarked against the reference card: warm paper, burgundy display serif,
  // large identity header, lines set slightly askew like hand-pasted type.
  editorial: {
    label: 'Editorial',
    style: {
      fontFamily: 'editorial',
      fontSize: 84,
      fontWeight: 400,
      letterSpacing: -0.018,
      lineHeight: 1.02,
      textAlign: 'center',
      textColor: '#8A0F10',
      metaColor: '#141414',
      background: { type: 'solid', color: '#FAF8F3' },
      texture: 'paper',
      textureIntensity: 0.45,
      verticalAlign: 'center',
      padding: 80,
      textWidth: 0.96,
      curve: 0.7,
      ...PROFILE_FULL,
      headerSize: 220,
      showSignature: false,
    },
  },
  minimal: {
    label: 'Minimal',
    style: {
      fontFamily: 'minimal',
      fontSize: 60,
      fontWeight: 400,
      letterSpacing: -0.012,
      lineHeight: 1.28,
      textAlign: 'left',
      textColor: '#111111',
      metaColor: '#8C8C8C',
      background: { type: 'solid', color: '#FFFFFF' },
      texture: 'none',
      textureIntensity: 0,
      verticalAlign: 'center',
      padding: 110,
      textWidth: 0.9,
      curve: 0,
      showProfile: true,
      showAvatar: false,
      showUsername: false,
      showVerifiedBadge: false,
      headerSize: 90,
      showSignature: false,
    },
  },
  midnight: {
    label: 'Midnight',
    style: {
      fontFamily: 'elegant',
      fontSize: 94,
      fontWeight: 600,
      letterSpacing: 0,
      lineHeight: 1.06,
      textAlign: 'center',
      textColor: '#F2EEE6',
      metaColor: '#A9A29A',
      background: { type: 'solid', color: '#0E0E10' },
      texture: 'grain',
      textureIntensity: 0.55,
      verticalAlign: 'center',
      padding: 100,
      textWidth: 0.9,
      curve: 0,
      ...PROFILE_FULL,
      headerSize: 120,
      showSignature: false,
    },
  },
  typewriter: {
    label: 'Typewriter',
    style: {
      fontFamily: 'typewriter',
      fontSize: 52,
      fontWeight: 400,
      letterSpacing: 0,
      lineHeight: 1.45,
      textAlign: 'left',
      textColor: '#2A2521',
      metaColor: '#5E554C',
      background: { type: 'solid', color: '#EEE4D0' },
      texture: 'paper',
      textureIntensity: 0.95,
      verticalAlign: 'center',
      padding: 110,
      textWidth: 0.94,
      curve: 0.1,
      showProfile: false,
      showAvatar: true,
      showUsername: true,
      showVerifiedBadge: false,
      headerSize: 110,
      showSignature: true,
    },
  },
  journal: {
    label: 'Journal',
    style: {
      fontFamily: 'handwritten',
      fontSize: 86,
      fontWeight: 600,
      letterSpacing: 0,
      lineHeight: 1.08,
      textAlign: 'left',
      textColor: '#1F2A44',
      metaColor: '#1F2A44',
      background: { type: 'solid', color: '#FBF6EA' },
      texture: 'paper',
      textureIntensity: 0.75,
      verticalAlign: 'center',
      padding: 100,
      textWidth: 0.95,
      curve: 0.35,
      showProfile: false,
      showAvatar: true,
      showUsername: true,
      showVerifiedBadge: false,
      headerSize: 110,
      showSignature: true,
    },
  },
  modern: {
    label: 'Modern',
    style: {
      fontFamily: 'bold',
      fontSize: 98,
      fontWeight: 800,
      letterSpacing: -0.025,
      lineHeight: 1.0,
      textAlign: 'left',
      textColor: '#111111',
      metaColor: '#111111',
      background: { type: 'solid', color: '#ECE8E1' },
      texture: 'noise',
      textureIntensity: 0.18,
      verticalAlign: 'bottom',
      padding: 90,
      textWidth: 1,
      curve: 0,
      ...PROFILE_FULL,
      headerSize: 100,
      showSignature: false,
    },
  },
  gradient: {
    label: 'Gradient',
    style: {
      fontFamily: 'modern',
      fontSize: 70,
      fontWeight: 600,
      letterSpacing: -0.02,
      lineHeight: 1.16,
      textAlign: 'center',
      textColor: '#2A2433',
      metaColor: '#2A2433',
      background: { type: 'gradient', colors: GRADIENTS[0].colors, angle: 135 },
      texture: 'grain',
      textureIntensity: 0.4,
      verticalAlign: 'center',
      padding: 100,
      textWidth: 0.9,
      curve: 0,
      ...PROFILE_FULL,
      headerSize: 110,
      showSignature: false,
    },
  },
  photograph: {
    label: 'Photograph',
    style: {
      fontFamily: 'classic',
      fontSize: 64,
      fontWeight: 400,
      letterSpacing: 0,
      lineHeight: 1.26,
      textAlign: 'left',
      textColor: '#FFFFFF',
      metaColor: '#FFFFFF',
      background: { type: 'image', uri: null, dim: 0.45 },
      texture: 'film',
      textureIntensity: 0.45,
      verticalAlign: 'bottom',
      padding: 90,
      textWidth: 0.95,
      curve: 0,
      ...PROFILE_FULL,
      headerSize: 100,
      showSignature: false,
    },
  },
};

export function createDesign(template: TemplateId = 'editorial'): QuoteDesign {
  return { version: DESIGN_VERSION, template, format: 'portrait', signature: '', ...TEMPLATES[template].style };
}

/**
 * Switches template: every style default changes, but the person's format,
 * signature text and chosen photo carry over.
 */
export function applyTemplate(design: QuoteDesign, template: TemplateId): QuoteDesign {
  const next = { ...createDesign(template), format: design.format, signature: design.signature };
  if (next.background.type === 'image' && design.background.type === 'image') {
    next.background = { ...next.background, uri: design.background.uri, path: design.background.path };
  }
  return next;
}

/** Template size scaled for text length: short thoughts get bigger type, long ones smaller. */
export function suggestedFontSize(template: TemplateId, textLength: number): number {
  const base = TEMPLATES[template].style.fontSize;
  const factor =
    textLength <= 40 ? 1.25 : textLength <= 90 ? 1.1 : textLength <= 160 ? 1 : textLength <= 260 ? 0.86 : textLength <= 380 ? 0.74 : 0.64;
  return Math.round(base * factor);
}
