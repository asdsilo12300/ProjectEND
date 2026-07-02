import { AppIcon } from '../icons/IconifyIcon'

const posts = [
  {
    id: 1,
    author: 'James',
    handle: '@dev_james',
    avatar: 'J',
    body: 'Crafting a simple notes app that syncs with local storage, and uses MD to write note content but shortcuts make it much easier.',
    replies: 3,
    reposts: 12,
    likes: 198,
  },
  {
    id: 2,
    author: 'Michael',
    handle: '@michael_js',
    avatar: 'M',
    body: 'One of my most-used sites: https://grep.app\n\nStupid-fast search across Github repos.\n\nEx: In this one, I wanted to see how people are doing something with layouts in Next.',
    replies: 30,
    reposts: 110,
    likes: '12K',
    saved: true,
  },
  {
    id: 3,
    author: 'Andrew',
    handle: '@andrew_tweets',
    avatar: 'A',
    body: 'Light mode testing for the lesson dashboard.',
    image: true,
    replies: 18,
    reposts: 42,
    likes: 620,
  },
]

const trends = [
  { topic: '#OpenAI', meta: 'Technology', posts: '10K posts' },
  { topic: '#Microscope', meta: 'Lab tools', posts: '5.2K posts' },
  { topic: '#PlantLab', meta: 'Classroom', posts: '3.2K posts' },
]

function LeftNavItem({ icon, label, active = false }) {
  return (
    <button
      type="button"
      className={`flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-lime-200 ${
        active ? 'bg-white/[0.055] font-bold text-lime-50' : 'text-slate-300 hover:bg-white/[0.04] hover:text-lime-50'
      }`}
    >
      <AppIcon className={`h-4 w-4 ${active ? 'text-lime-100' : 'text-slate-400'}`} name={icon} />
      {label}
    </button>
  )
}

function ActionButton({ icon, value, active = false }) {
  return (
    <button
      type="button"
      className={`inline-flex items-center gap-2 text-xs transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-lime-200 ${
        active ? 'text-rose-400' : 'text-slate-400 hover:text-lime-100'
      }`}
    >
      <AppIcon className="h-4 w-4" name={icon} />
      <span>{value}</span>
    </button>
  )
}

function MockPreview() {
  return (
    <div className="mt-3 overflow-hidden rounded-lg border border-lime-100/10 bg-[#f5f5f1] p-5 text-[#151916]">
      <div className="grid grid-cols-3 gap-3">
        {['Availability', 'Opening times', 'Manage bookings', 'Calendar view', 'Transactions', 'Modify settings'].map((label, index) => (
          <div key={label} className="min-h-24 rounded-md bg-white p-3 shadow-sm">
            <strong className="block text-[10px] text-slate-800">{label}</strong>
            <div className="mt-3 space-y-2">
              <span className={`block h-2 rounded-full ${index % 2 ? 'bg-slate-200' : 'bg-lime-200'}`} />
              <span className="block h-2 w-2/3 rounded-full bg-slate-200" />
              <span className="block h-2 w-1/2 rounded-full bg-slate-200" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function FeedPost({ post }) {
  return (
    <article className="border-b border-lime-100/10 px-8 py-7 transition hover:bg-white/[0.018]">
      <div className="flex gap-4">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#263022] text-sm font-black text-lime-100 ring-1 ring-lime-100/10">
          {post.avatar}
        </span>
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex items-start justify-between gap-3">
            <div className="min-w-0">
              <strong className="mr-1 text-sm text-lime-50">{post.author}</strong>
              <span className="text-xs text-slate-400">{post.handle}</span>
            </div>
            <button type="button" className="rounded-md p-1 text-slate-400 transition hover:bg-white/[0.06] hover:text-lime-50" aria-label="Post menu">
              <AppIcon className="h-4 w-4" name="more" />
            </button>
          </div>
          <p className="whitespace-pre-line text-sm leading-6 text-slate-100">{post.body}</p>
          {post.image && <MockPreview />}
          <div className="mt-5 grid grid-cols-4 text-slate-400">
            <ActionButton icon="chat" value={post.replies} />
            <ActionButton icon="repeat" value={post.reposts} />
            <ActionButton icon="heart" value={post.likes} active />
            <ActionButton icon="bookmark" value="" active={post.saved} />
          </div>
        </div>
      </div>
    </article>
  )
}

export function CommunityPage() {
  return (
    <section className="absolute inset-x-0 bottom-0 top-16 z-10 overflow-hidden bg-[#111514] text-slate-100">
      <div className="mx-auto grid h-full max-w-[1180px] grid-cols-[220px_minmax(420px,1fr)_260px] border-x border-lime-100/10 max-lg:grid-cols-[180px_minmax(0,1fr)] max-md:grid-cols-1">
        <aside className="border-r border-lime-100/10 bg-[#151817] px-5 py-8 max-md:hidden">
          <nav className="space-y-2" aria-label="Community sections">
            <LeftNavItem icon="home" label="Home" active />
            <LeftNavItem icon="search" label="Search" />
            <LeftNavItem icon="notifications" label="Notifications" />
          </nav>
        </aside>

        <main className="min-w-0 overflow-y-auto bg-[#141817]">
          <div className="sticky top-0 z-10 grid grid-cols-2 border-b border-lime-100/10 bg-[#141817]/95 backdrop-blur">
            <button type="button" className="relative px-4 py-4 text-center text-sm font-bold text-lime-50">
              For you
              <span className="absolute bottom-0 left-1/2 h-0.5 w-16 -translate-x-1/2 rounded-full bg-[#8fbf78]" />
            </button>
            <button type="button" className="px-4 py-4 text-center text-sm text-slate-400 transition hover:text-lime-100">
              Friends
            </button>
          </div>

          {posts.map((post) => (
            <FeedPost key={post.id} post={post} />
          ))}
        </main>

        <aside className="border-l border-lime-100/10 bg-[#151817] px-5 py-6 max-lg:hidden">
          <label className="relative block">
            <span className="sr-only">Search community</span>
            <AppIcon className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" name="search" />
            <input
              className="h-11 w-full rounded-full border border-lime-100/10 bg-[#101312] pl-11 pr-4 text-sm text-lime-50 outline-none transition placeholder:text-slate-500 focus:border-[#8fbf78]"
              placeholder="search here..."
              type="search"
            />
          </label>

          <section className="mt-6 rounded-lg bg-[#171b1a] p-4">
            <h2 className="text-sm font-black text-lime-50">What&apos;s happening</h2>
            <div className="mt-4 space-y-4">
              {trends.map((trend) => (
                <article key={trend.topic} className="group flex items-start justify-between gap-3">
                  <div>
                    <span className="block text-[11px] text-slate-500">{trend.meta}</span>
                    <strong className="block text-sm text-lime-50 group-hover:text-[#b8dea2]">{trend.topic}</strong>
                    <span className="text-[11px] text-slate-500">{trend.posts}</span>
                  </div>
                  <button type="button" className="rounded-md p-1 text-slate-500 hover:bg-white/[0.06] hover:text-lime-50" aria-label={`More about ${trend.topic}`}>
                    <AppIcon className="h-4 w-4" name="more" />
                  </button>
                </article>
              ))}
            </div>
            <button type="button" className="mt-5 text-sm font-semibold text-[#8fbf78] hover:text-lime-100">
              Show more
            </button>
          </section>
        </aside>
      </div>
    </section>
  )
}