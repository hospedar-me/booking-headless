import type {
  BookingEngineAccommodationCategoryCatalogItem,
  BookingEngineRatePlanCatalogItem,
  PropertyContentSection,
  PublicReservationGuestReview,
  ReservationGuestReviewSummary,
} from "../sdk/types.gen";

export type BookingFormCopyViewData = {
  stayPeriodLabel?: string | null;
  stayPeriodPlaceholder?: string | null;
  guestsLabel?: string | null;
  searchButtonLabel?: string | null;
  advancedToggleOpenLabel?: string | null;
  advancedToggleCloseLabel?: string | null;
  roomsLabel?: string | null;
  distributionLabel?: string | null;
  adultsLabel?: string | null;
  childrenLabel?: string | null;
  childrenAgesLabel?: string | null;
} | null;

export type HeroViewData = {
  title?: string | null;
  eyebrow?: string | null;
  description?: string | null;
  backgroundImageUrl?: string | null;
} | null;

export type SiteBrandViewData = {
  description?: string | null;
  brandName?: string | null;
  logoUrl?: string | null;
  logoAlt?: string | null;
} | null;

export type RoomsHeaderViewData = {
  title?: string | null;
  description?: string | null;
  sectionId?: string | null;
  eyebrow?: string | null;
} | null;

export type LocationViewData = {
  eyebrow?: string | null;
  title?: string | null;
  description?: string | null;
  nearbyDescription?: string | null;
  addressLabel?: string | null;
  address?: string | null;
  mapUrl?: string | null;
  mapEmbedUrl?: string | null;
  routeButtonLabel?: string | null;
} | null;

export type ReviewSummaryViewData = ReservationGuestReviewSummary | null;

export type PublicReviewViewData = PublicReservationGuestReview;

export type ReviewsSectionCopyViewData = {
  eyebrow?: string | null;
  title?: string | null;
  description?: string | null;
  ctaLabel?: string | null;
  ctaHref?: string | null;
  emptyTitle?: string | null;
  emptyDescription?: string | null;
} | null;

export type ReviewsSectionViewData = {
  eyebrow?: string | null;
  title?: string | null;
  description?: string | null;
  ctaLabel?: string | null;
  ctaHref?: string | null;
  emptyTitle?: string | null;
  emptyDescription?: string | null;
  reviews?: PublicReviewViewData[] | null;
  summary?: ReviewSummaryViewData;
} | null;

export type FooterSocialLink = {
  platform?: string | null;
  url?: string | null;
  label?: string | null;
};

export type FooterNavLink = {
  label?: string | null;
  href?: string | null;
};

export type FooterLegalLink = {
  label?: string | null;
  href?: string | null;
};

export type FooterViewData = {
  brandName?: string | null;
  brandDescription?: string | null;
  logoUrl?: string | null;
  logoAlt?: string | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
  contactAddress?: string | null;
  reservationsTitle?: string | null;
  reservationsDescription?: string | null;
  reservationsPhone?: string | null;
  reservationsHours?: string | null;
  checkInTime?: string | null;
  checkOutTime?: string | null;
  copyright?: string | null;
  socialLinks?: FooterSocialLink[] | null;
  navLinks?: FooterNavLink[] | null;
  legalLinks?: FooterLegalLink[] | null;
} | null;

export type GalleryImageViewData = {
  id?: string | null;
  title?: string | null;
  description?: string | null;
  category?: string | null;
  categoryLabel?: string | null;
  imageUrl?: string | null;
  alt?: string | null;
  orientation?: "portrait" | "landscape" | "square" | null;
  featured?: boolean | null;
};

export type GalleryPageContent = {
  eyebrow?: string | null;
  title?: string | null;
  description?: string | null;
  backLabel?: string | null;
  allFilterLabel?: string | null;
  featuredLabel?: string | null;
  carouselLabel?: string | null;
  photosLabel?: string | null;
  images?: GalleryImageViewData[] | null;
} | null;

export type RoomsViewData = BookingEngineAccommodationCategoryCatalogItem[];

export type BookingFormCategoryOption = Pick<
  BookingEngineAccommodationCategoryCatalogItem,
  "id" | "name"
>;

export type BookingFormRatePlanOption = Pick<
  BookingEngineRatePlanCatalogItem,
  "id" | "name"
>;

export type HomePageContent = {
  bookingFormCopy: BookingFormCopyViewData;
  roomsHeader: RoomsHeaderViewData;
  location?: LocationViewData;
  reviews?: ReviewsSectionCopyViewData;
  gallery?: GalleryPageContent;
  footerContent: FooterViewData;
};

export type HomePageViewModel = {
  hero: HeroViewData;
  bookingFormCopy: BookingFormCopyViewData;
  roomsHeader: RoomsHeaderViewData;
  rooms: RoomsViewData;
  ratePlans: BookingEngineRatePlanCatalogItem[];
  location: LocationViewData;
  reviews: ReviewsSectionViewData;
  footer: FooterViewData;
};

export type GalleryPageViewModel = {
  gallery: GalleryPageContent;
  footer: FooterViewData;
};

export type ReviewsPageContent = {
  eyebrow?: string | null;
  title?: string | null;
  description?: string | null;
  backLabel?: string | null;
  allFilterLabel?: string | null;
  withCommentLabel?: string | null;
  withResponseLabel?: string | null;
  searchPlaceholder?: string | null;
  emptyTitle?: string | null;
  emptyDescription?: string | null;
} | null;

export type ReviewsPageViewModel = {
  content: ReviewsPageContent;
  reviews: PublicReviewViewData[];
  summary: ReviewSummaryViewData;
  footer: FooterViewData;
};

export type PropertyContentSectionViewData = PropertyContentSection;

export type TermsPageContent = {
  eyebrow?: string | null;
  title: string;
  description?: string | null;
  backLabel: string;
  emptyTitle: string;
  emptyDescription: string;
  updatedLabel: string;
  sectionTypes: Record<string, string>;
};

export type TermsPageViewModel = {
  content: TermsPageContent;
  sections: PropertyContentSectionViewData[];
  footer: FooterViewData;
};
