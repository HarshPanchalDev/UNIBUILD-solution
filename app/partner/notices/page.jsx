import { PageHeader } from "@/components/ui";
import NoticeList from "@/components/partner/NoticeList";
import { requirePartnerPage } from "@/lib/server/auth";
import { getT } from "@/lib/i18n/server";
import { loadNotices } from "@/lib/server/partnerData";

export default async function NoticesPage() {
  const s = await requirePartnerPage();
  const { lang, t } = await getT();
  const notices = await loadNotices(s.user.id, lang, 100);
  return (
    <>
      <PageHeader title={t("noticesPage.title")} />
      <NoticeList notices={notices} lang={lang} />
    </>
  );
}
