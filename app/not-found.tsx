import Link from "next/link";

export default function NotFound() {
  return (
    <div className="card">
      <div className="empty">
        <h3>الصفحة غير موجودة</h3>
        <p>الرابط الذي فتحته غير صحيح أو لم يعد متاحًا.</p>
        <Link href="/" className="btn btn-primary">
          العودة إلى لوحة التحكم
        </Link>
      </div>
    </div>
  );
}
