<aside className="w-56 bg-white border-r border-gray-200 flex flex-col fixed inset-y-0 left-0 z-20 shadow-sm">
        {/* Logo */}
        <div className="px-5 h-[72px] flex items-center justify-between border-b border-gray-100 bg-white">
          <div className="h-9 flex items-center flex-shrink-0">
            <img src="/logo.png" alt="Logo" className="h-full object-contain" />
          </div>
          <div className="text-[10px] font-bold text-gray-400 uppercase text-right leading-tight tracking-wider ml-2">
            Yönetim<br/>Paneli
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 py-4 px-3 space-y-1 overflow-y-auto bg-white">
          {/* Dashboard Direct Link */}
          <NavLink
            to="/admin/dashboard"
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-r-full transition-all text-[13px] font-bold ${
                isActive 
                  ? 'text-primary-700 border-l-[3px] border-primary-600' 
                  : 'text-gray-600 hover:text-primary-600 border-l-[3px] border-transparent'
              }`
            }
          >
            <span className="w-[18px] h-[18px] flex-shrink-0">
              <SidebarIcon path="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z M9 22V12h6v10" />
            </span>
            <span>Ana Sayfa</span>
          </NavLink>

          <div className="pt-3 mt-3 border-t border-gray-100 space-y-1">
            {NAV_GROUPS.map((group) => {
              const visibleItems = group.items.filter(item => !item.adminOnly || user?.role === 'ADMIN');
              if (visibleItems.length === 0) return null;

              const isGroupActive = visibleItems.some(item => location.pathname.startsWith(item.to));
              const isOpen = !!openGroups[group.id];

              return (
                <div key={group.id} className="transition-all">
                  {/* Collapsible Accordion Header */}
                  <button
                    type="button"
                    onClick={() => toggleGroup(group.id)}
                    className={`w-full flex items-center justify-between px-3 py-2.5 rounded-r-full text-[13px] font-bold transition-all select-none ${
                      isGroupActive || isOpen
                        ? 'text-primary-700 border-l-[3px] border-primary-600'
                        : 'text-gray-600 hover:text-primary-600 border-l-[3px] border-transparent'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className={`w-[18px] h-[18px] flex-shrink-0 ${isGroupActive || isOpen ? 'text-primary-600' : 'text-gray-400'}`}>
                        {group.icon}
                      </span>
                      <span>{group.title}</span>
                    </div>
                    <svg
                      viewBox="0 0 24 24"
                      className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${isOpen ? 'rotate-180 text-gray-600' : ''}`}
                      fill="none" stroke="currentColor" strokeWidth="2"
                    >
                      <path d="M6 9l6 6 6-6" />
                    </svg>
                  </button>

                  {/* Sub-items (collapsible container) */}
                  {isOpen && (
                    <div className="pl-[22px] py-1.5 space-y-1 mt-1 border-l-[1.5px] border-gray-100 ml-[18px]">
                      {visibleItems.map((item) => (
                        <NavLink
                          key={item.to}
                          to={item.to}
                          className={({ isActive }) =>
                            `flex items-center gap-2.5 px-3 py-2 rounded-full text-[13px] font-semibold transition-all ml-2 ${
                              isActive
                                ? 'text-primary-700 font-bold'
                                : 'text-gray-500 hover:text-primary-600'
                            }`
                          }
                        >
                          {({ isActive }) => (
                            <>
                              <span className={`w-4 h-4 flex-shrink-0 ${isActive ? 'text-primary-600' : 'text-gray-400'}`}>{item.icon}</span>
                              <span className="truncate">{item.label}</span>
                            </>
                          )}
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
        <div className="border-t border-gray-100 p-5 space-y-3 bg-white">
          <div className="flex items-center gap-3 mb-1">
            <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center text-primary-700 font-bold text-base flex-shrink-0">
              {(user?.username || user?.email || 'A')[0].toUpperCase()}
            </div>
            <div className="overflow-hidden">
              <div className="text-[13px] font-bold text-gray-900 truncate tracking-tight">
                {user?.username || user?.email || 'Kullanıcı'}
              </div>
              <div className="text-[11px] font-bold text-gray-500 uppercase tracking-wider mt-0.5">
                {user?.role === 'ADMIN' ? 'Yönetici' : 'Değerlendirici'}
              </div>
            </div>
          </div>
          <button
            onClick={() => setIsPasswordModalOpen(true)}
            className="w-full py-2 px-4 rounded-full border border-gray-200 bg-white hover:bg-gray-50 text-xs font-bold text-gray-700 transition-all flex items-center justify-center gap-2"
          >
            <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
            Şifre Değiştir
          </button>
          <button
            onClick={handleLogout}
            className="w-full py-2 px-4 rounded-full bg-primary-50 hover:bg-primary-100 text-xs font-bold text-primary-700 transition-all flex items-center justify-center gap-2"
          >
            <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
            Güvenli Çıkış
          </button>
        </div>
      </aside>