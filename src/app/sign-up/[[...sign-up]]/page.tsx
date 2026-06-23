import { SignUp } from "@clerk/nextjs";

export default function SignUpPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-agri-50 via-white to-emerald-50 flex items-center justify-center p-4">
      <div className="flex flex-col items-center gap-6">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-agri-500 to-agri-600 flex items-center justify-center shadow-lg">
            <span className="text-white text-xl">🌿</span>
          </div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-agri-700 to-agri-500 bg-clip-text text-transparent">
            AgriSense
          </h1>
        </div>
        <SignUp />
      </div>
    </div>
  );
}
