<aside className="w-56 bg-white/70 backdrop-blur-xl border-r border-slate-200/70 shadow-sm flex flex-col fixed inset-y-0 left-0 z-20">
        {/* Logo */}
        <div className="px-3.5 h-14 flex items-center justify-between border-b border-slate-200/70 bg-white/40 backdrop-blur-md">
          <div className="h-7 flex items-center flex-shrink-0">
            <img src="/logo.png" alt="Logo" className="h-full object-contain" />
          </div>
          <div className="text-[10px] font-bold text-gray-400 uppercase text-right leading-tight tracking-wider">
            Yönetim<br/>Paneli
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 py-3 px-2 space-y-1.5 overflow-y-auto">
          {/* Dashboard Direct Link */}
          <NavLink
            to="/admin/dashboard"
            className={({ isActive }) =>
              `nav-item font-semibold text-xs ${isActive ? 'nav-item-active' : 'text-gray-700 hover:bg-gray-100/80'}`
            }
          >
            <span className="w-4 h-4 flex-shrink-0">
              <SidebarIcon path="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z M9 22V12h6v10" />
            </span>
            <span>Ana Sayfa</span>
          </NavLink>

          <div className="pt-2 border-t border-gray-200/60 space-y-1">
            {NAV_GROUPS.map((group) => {
              const visibleItems = group.items.filter(item => !item.adminOnly || user?.role === 'ADMIN');
              if (visibleItems.length === 0) return null;

              const isGroupActive = visibleItems.some(item => location.pathname.startsWith(item.to));
              const isOpen = !!openGroups[group.id];

              return (
                <div key={group.id} className="rounded-xl overflow-hidden transition-all">
                  {/* Collapsible Accordion Header */}
                  <button
                    type="button"
                    onClick={() => toggleGroup(group.id)}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-bold transition-all select-none ${
                      isGroupActive
                        ? 'text-primary-700 bg-primary-50/70 hover:bg-primary-50'
                        : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100/80'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className={`w-4 h-4 flex-shrink-0 ${isGroupActive ? 'text-primary-600' : 'text-gray-400'}`}>
                        {group.icon}
                      </span>
                      <span>{group.title}</span>
                    </div>

                    <svg
                      viewBox="0 0 24 24"
                      className={`w-3.5 h-3.5 text-gray-400 transition-transform duration-200 ${isOpen ? 'rotate-180 text-gray-600' : ''}`}
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                    >
                      <path d="M6 9l6 6 6-6" />
                    </svg>
                  </button>

                  {/* Sub-items (collapsible container) */}
                  {isOpen && (
                    <div className="pl-2 pr-1 py-1 space-y-0.5 border-l-2 border-primary-200 ml-3.5 mt-0.5 animate-fade-in">
                      {visibleItems.map((item) => (
                        <NavLink
                          key={item.to}
                          to={item.to}
                          className={({ isActive }) =>
                            `flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs transition-all ${
                              isActive
                                ? 'bg-primary-50 text-primary-700 hover:text-primary-800 font-bold border border-primary-100 shadow-2xs'
                                : 'text-gray-600 hover:text-gray-950 hover:bg-gray-100 font-medium'
                            }`
                          }
                        >
                          <span className="w-3.5 h-3.5 flex-shrink-0 opacity-90">{item.icon}</span>
                          <span className="truncate">{item.label}</span>
                        </NavLink>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </nav>

        {/* Bottom user area */}
        <div className="border-t border-slate-200/70 p-4 space-y-2 bg-white/40">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-9 h-9 rounded-xl bg-primary-100 flex items-center justify-center text-primary-700 font-bold text-sm flex-shrink-0 shadow-sm border border-primary-200">
              {(user?.username || user?.email || 'A')[0].toUpperCase()}
            </div>
            <div className="overflow-hidden">
              <div className="text-sm font-bold text-gray-900 truncate tracking-tight">
                {user?.username || user?.email || 'Admin'}
              </div>
              <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                {user?.role === 'ADMIN' ? 'Yönetici' : 'Değerlendirici'}
              </div>
            </div>
          </div>
          <button
            onClick={() => setIsPasswordModalOpen(true)}
            className="w-full py-2 px-3 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 hover:border-gray-300 text-xs font-bold text-gray-700 transition-all flex items-center justify-center gap-2 shadow-sm"
          >
            <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.5"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
            Şifre Değiştir
          </button>
          <button
            onClick={handleLogout}
            className="w-full py-2 px-3 rounded-xl border border-red-100 bg-red-50 hover:bg-red-100 text-xs font-bold text-red-600 transition-all flex items-center justify-center gap-2 shadow-sm"
          >
            <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
            Güvenli Çıkış
          </button>
        </div>
      </aside>