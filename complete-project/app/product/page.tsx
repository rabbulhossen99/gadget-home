import { AdminShell } from "@/components/admin/admin-shell"
import { CreateProductForm } from "@/components/product/create-product-form"

export default function ProductPage() {
  return (
    <AdminShell>
      <div className="mb-5">
        <h1 className="text-2xl font-bold text-foreground">Create Product</h1>
        <p className="text-sm text-muted-foreground">
          Add a product and configure its Meta Ads pixel targeting.
        </p>
      </div>
      <CreateProductForm />
    </AdminShell>
  )
}
