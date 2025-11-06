interface AuthorBioProps {
  author: {
    directus_users: {
      id: string;
      first_name: string;
      last_name: string;
      email: string;
      hil_profiles: {
        bio: string;
        profile_image: string;
        verified_human?: boolean;
        social_link?: string;
      }[];
    }[];
  };
}

export default function AuthorBio({ author }: AuthorBioProps) {
  // Handle nested arrays from Supabase
  const user = Array.isArray(author.directus_users)
    ? author.directus_users[0]
    : author.directus_users;

  if (!user) return null;

  const profile = Array.isArray(user.hil_profiles)
    ? user.hil_profiles[0]
    : user.hil_profiles;

  if (!profile) return null;

  const { first_name, last_name } = user;
  const fullName = `${first_name} ${last_name}`;

  // Create author slug for profile link
  const authorSlug = fullName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

  return (
    <section className="bg-white rounded-lg shadow-lg border border-gray-200 mb-8 p-6">
      <div className="flex items-start gap-4">
        <img
          src={profile.profile_image}
          alt={fullName}
          className="w-16 h-16 rounded-full object-cover flex-shrink-0 border-2 border-gray-200"
          loading="lazy"
        />
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <h3 className="font-bold text-lg text-gray-900">
              <a
                href={`/authors/${authorSlug}`}
                className="hover:text-indigo-600 transition-colors duration-200"
              >
                {fullName}
              </a>
            </h3>
            {profile.verified_human && (
              <span className="inline-flex items-center gap-1 text-xs bg-green-50 text-green-700 font-medium px-2 py-1 rounded-full border border-green-200">
                <svg
                  className="w-3 h-3"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                    clipRule="evenodd"
                  ></path>
                </svg>
                Verified Human Author
              </span>
            )}
          </div>
          <p className="text-sm text-gray-600 leading-relaxed">{profile.bio}</p>
          <p className="text-xs text-gray-500 italic mt-3 pt-3 border-t border-gray-100">
            This article was assisted by AI and reviewed by {fullName}.
          </p>
        </div>
      </div>
    </section>
  );
}
