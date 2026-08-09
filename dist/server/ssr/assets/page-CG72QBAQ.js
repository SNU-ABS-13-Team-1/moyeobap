import { a as require_react, o as __toESM, t as require_jsx_runtime } from "../index.js";
//#region app/data/cafes.ts
var import_react = /* @__PURE__ */ __toESM(require_react(), 1);
var INITIAL_CAFES = [
	{
		id: "cafe_001",
		name: "메가MGC커피 배곧한라비발디점",
		location: "시흥캠 도보 5분 / 배곧한라비발디 1차 상가",
		badge: "🔥 시흥캠 인기 1위",
		visual: "☕",
		tone: "amber",
		menus: [
			{
				id: "m_mega_1",
				name: "아이스 아메리카노",
				price: 2e3,
				visual: "🧊☕",
				popular: true
			},
			{
				id: "m_mega_2",
				name: "아샷추 (아이스티+샷추가)",
				price: 3e3,
				visual: "🍑☕",
				popular: true
			},
			{
				id: "m_mega_3",
				name: "할메가커피",
				price: 1900,
				visual: "👵☕"
			},
			{
				id: "m_mega_4",
				name: "플레인 퐁크러쉬",
				price: 3900,
				visual: "🥛🌾",
				popular: true
			},
			{
				id: "m_mega_5",
				name: "큐브라떼",
				price: 4200,
				visual: "🧊🥛"
			},
			{
				id: "m_mega_6",
				name: "감자빵 / 감자 크로플",
				price: 3500,
				visual: "🥔🥐"
			}
		]
	},
	{
		id: "cafe_002",
		name: "스타벅스 시흥배곧점",
		location: "배곧 중심상가",
		badge: "⭐ 시동/연구모임 단골",
		visual: "🟢",
		tone: "emerald",
		menus: [
			{
				id: "m_sb_1",
				name: "아이스 자몽 허니 블랙 티 (자허블)",
				price: 5700,
				visual: "🍹",
				popular: true
			},
			{
				id: "m_sb_2",
				name: "아이스 카페 라떼",
				price: 5e3,
				visual: "🥛☕"
			},
			{
				id: "m_sb_3",
				name: "스타벅스 돌체 라떼",
				price: 5900,
				visual: "🍯☕",
				popular: true
			},
			{
				id: "m_sb_4",
				name: "아이스 아메리카노 (Grand)",
				price: 5e3,
				visual: "🧊☕"
			},
			{
				id: "m_sb_5",
				name: "부드러운 생크림 카스텔라",
				price: 4500,
				visual: "🍰"
			}
		]
	},
	{
		id: "cafe_003",
		name: "컴포즈커피 배곧테크노밸리점",
		location: "배곧 테크노밸리 1층",
		badge: "⚡ 가성비 최강",
		visual: "🟡",
		tone: "yellow",
		menus: [
			{
				id: "m_comp_1",
				name: "아이스 아메리카노",
				price: 1500,
				visual: "🧊☕",
				popular: true
			},
			{
				id: "m_comp_2",
				name: "아인슈페너",
				price: 4200,
				visual: "🍦☕",
				popular: true
			},
			{
				id: "m_comp_3",
				name: "리얼초코 라떼",
				price: 3500,
				visual: "🍫🥛"
			},
			{
				id: "m_comp_4",
				name: "사과생크림 와플",
				price: 3e3,
				visual: "🧇",
				popular: true
			},
			{
				id: "m_comp_5",
				name: "벨지움 생초콜릿 라떼",
				price: 4500,
				visual: "🍫☕"
			}
		]
	},
	{
		id: "cafe_004",
		name: "더벤티 시흥배곧한라점",
		location: "배곧한라 2차 단지상가",
		badge: "🥤 대용량 음료 전문",
		visual: "🟣",
		tone: "purple",
		menus: [
			{
				id: "m_venti_1",
				name: "아이스 아메리카노 (Venti)",
				price: 1800,
				visual: "🧊☕",
				popular: true
			},
			{
				id: "m_venti_2",
				name: "멜팅초코 쉐이크",
				price: 3900,
				visual: "🍫🥤"
			},
			{
				id: "m_venti_3",
				name: "코코넛 쉐이킹",
				price: 4300,
				visual: "🥥🥛",
				popular: true
			},
			{
				id: "m_venti_4",
				name: "청포도 에이드",
				price: 3500,
				visual: "🍇🍹"
			}
		]
	},
	{
		id: "cafe_005",
		name: "빽다방 배곧한라점",
		location: "배곧한라비발디 상가 1층",
		badge: "🧊 원조 달달커피",
		visual: "🔵",
		tone: "blue",
		menus: [
			{
				id: "m_paik_1",
				name: "원조커피 (아이스)",
				price: 2500,
				visual: "🧊🍯",
				popular: true
			},
			{
				id: "m_paik_2",
				name: "앗!메리카노",
				price: 2e3,
				visual: "🧊☕"
			},
			{
				id: "m_paik_3",
				name: "완전딸기바나나 빽스치노",
				price: 3800,
				visual: "🍓🍌",
				popular: true
			},
			{
				id: "m_paik_4",
				name: "피스타치오 빽스치노",
				price: 4500,
				visual: "🥑🥤"
			}
		]
	},
	{
		id: "cafe_006",
		name: "이디야커피 시흥한라비발디점",
		location: "시흥캠 인근 한라비발디",
		badge: "🧋 토피넛라떼 명가",
		visual: "🔵",
		tone: "indigo",
		menus: [
			{
				id: "m_ediya_1",
				name: "토피넛 라떼 (아이스)",
				price: 4200,
				visual: "🥜☕",
				popular: true
			},
			{
				id: "m_ediya_2",
				name: "아이스 아메리카노",
				price: 3200,
				visual: "🧊☕"
			},
			{
				id: "m_ediya_3",
				name: "복숭아 아이스티",
				price: 2900,
				visual: "🍑🍹"
			},
			{
				id: "m_ediya_4",
				name: "허니 카라멜 브레드",
				price: 4800,
				visual: "🍞🍯",
				popular: true
			}
		]
	}
];
//#endregion
//#region app/page.tsx
var import_jsx_runtime = require_jsx_runtime();
var INITIAL_PARTIES = [
	{
		id: "party_1",
		cafeId: "cafe_001",
		cafeName: "메가MGC커피 배곧한라비발디점",
		hostId: "kakao_101",
		hostNickname: "3층 곰돌이 ☕",
		title: "14:00 메가커피 배달비 0원 팟 🚀",
		targetTime: "14:00",
		targetCount: 4,
		currentCount: 3,
		baeminLink: "https://m.baemin.com",
		status: "LINK_READY",
		createdAt: Date.now() - 1e3 * 60 * 20,
		members: [
			{
				userId: "kakao_101",
				nickname: "3층 곰돌이 ☕"
			},
			{
				userId: "kakao_102",
				nickname: "시흥캠 개발자 💻"
			},
			{
				userId: "kakao_103",
				nickname: "아샷추 러버 🍑"
			}
		]
	},
	{
		id: "party_2",
		cafeId: "cafe_002",
		cafeName: "스타벅스 시흥배곧점",
		hostId: "kakao_201",
		hostNickname: "자허블 짱 🍹",
		title: "14:30 스타벅스 오후 당충전 팟",
		targetTime: "14:30",
		targetCount: 3,
		currentCount: 1,
		status: "RECRUITING",
		createdAt: Date.now() - 1e3 * 60 * 5,
		members: [{
			userId: "kakao_201",
			nickname: "자허블 짱 🍹"
		}]
	},
	{
		id: "party_3",
		cafeId: "cafe_003",
		cafeName: "컴포즈커피 배곧테크노밸리점",
		hostId: "kakao_301",
		hostNickname: "연구원 A 🔬",
		title: "15:00 아메리카노 초스피드 팟",
		targetTime: "15:00",
		targetCount: 4,
		currentCount: 2,
		status: "RECRUITING",
		createdAt: Date.now() - 1e3 * 60 * 12,
		members: [{
			userId: "kakao_301",
			nickname: "연구원 A 🔬"
		}, {
			userId: "kakao_302",
			nickname: "배곧주민 🏠"
		}]
	}
];
function MoyeobapHome() {
	const [user, setUser] = (0, import_react.useState)(null);
	const [parties, setParties] = (0, import_react.useState)(INITIAL_PARTIES);
	const [cafes] = (0, import_react.useState)(INITIAL_CAFES);
	const [activeTab, setActiveTab] = (0, import_react.useState)("parties");
	const [selectedCafeForParty, setSelectedCafeForParty] = (0, import_react.useState)(null);
	const [newPartyTitle, setNewPartyTitle] = (0, import_react.useState)("");
	const [newPartyTime, setNewPartyTime] = (0, import_react.useState)("14:00");
	const [newPartyTargetCount, setNewPartyTargetCount] = (0, import_react.useState)(4);
	const [editingPartyId, setEditingPartyId] = (0, import_react.useState)(null);
	const [inputBaeminLink, setInputBaeminLink] = (0, import_react.useState)("");
	const [aiAnalyzing, setAiAnalyzing] = (0, import_react.useState)(false);
	const [aiSuccess, setAiSuccess] = (0, import_react.useState)(false);
	(0, import_react.useEffect)(() => {
		const savedUser = localStorage.getItem("moyeobap_kakao_user");
		if (savedUser) try {
			setUser(JSON.parse(savedUser));
		} catch (e) {
			console.error(e);
		}
	}, []);
	const handleKakaoLogin = () => {
		const mockUser = {
			id: `kakao_${Math.floor(Math.random() * 900 + 100)}`,
			nickname: `시흥캠 밥버디 #${Math.floor(Math.random() * 90 + 10)}`,
			avatarUrl: "https://api.dicebear.com/7.x/bottts/svg?seed=moyeobap"
		};
		setUser(mockUser);
		localStorage.setItem("moyeobap_kakao_user", JSON.stringify(mockUser));
	};
	const handleLogout = () => {
		setUser(null);
		localStorage.removeItem("moyeobap_kakao_user");
	};
	const handleCreateParty = (e) => {
		e.preventDefault();
		if (!user) {
			handleKakaoLogin();
			return;
		}
		if (!selectedCafeForParty) return;
		setParties([{
			id: `party_${Date.now()}`,
			cafeId: selectedCafeForParty.id,
			cafeName: selectedCafeForParty.name,
			hostId: user.id,
			hostNickname: user.nickname,
			title: newPartyTitle || `${newPartyTime} ${selectedCafeForParty.name.split(" ")[0]} 커피 팟`,
			targetTime: newPartyTime,
			targetCount: newPartyTargetCount,
			currentCount: 1,
			status: "RECRUITING",
			createdAt: Date.now(),
			members: [{
				userId: user.id,
				nickname: user.nickname
			}]
		}, ...parties]);
		setSelectedCafeForParty(null);
		setNewPartyTitle("");
		setActiveTab("parties");
	};
	const toggleJoinParty = (partyId) => {
		if (!user) {
			handleKakaoLogin();
			return;
		}
		setParties(parties.map((party) => {
			if (party.id !== partyId) return party;
			if (party.members.some((m) => m.userId === user.id)) {
				if (party.hostId === user.id) {
					alert("총대(호스트)는 팟을 삭제하거나 마감해야 합니다!");
					return party;
				}
				const updatedMembers = party.members.filter((m) => m.userId !== user.id);
				return {
					...party,
					currentCount: updatedMembers.length,
					members: updatedMembers
				};
			} else {
				if (party.currentCount >= party.targetCount) {
					alert("이미 인원이 가득 찬 팟입니다!");
					return party;
				}
				const updatedMembers = [...party.members, {
					userId: user.id,
					nickname: user.nickname
				}];
				return {
					...party,
					currentCount: updatedMembers.length,
					members: updatedMembers
				};
			}
		}));
	};
	const handleSaveBaeminLink = (partyId) => {
		if (!inputBaeminLink.trim()) return;
		let validUrl = inputBaeminLink.trim();
		if (!validUrl.startsWith("http://") && !validUrl.startsWith("https://")) validUrl = "https://" + validUrl;
		setParties(parties.map((p) => p.id === partyId ? {
			...p,
			baeminLink: validUrl,
			status: "LINK_READY"
		} : p));
		setEditingPartyId(null);
		setInputBaeminLink("");
	};
	const handleAiCaptureUpload = () => {
		if (!user) {
			handleKakaoLogin();
			return;
		}
		setAiAnalyzing(true);
		setAiSuccess(false);
		setTimeout(() => {
			setAiAnalyzing(false);
			setAiSuccess(true);
			setParties([{
				id: `party_ai_${Date.now()}`,
				cafeId: "cafe_001",
				cafeName: "메가MGC커피 배곧한라비발디점",
				hostId: user.id,
				hostNickname: user.nickname,
				title: "⚡ [AI 파싱 완료] 메가커피 아샷추 팟",
				targetTime: "14:15",
				targetCount: 4,
				currentCount: 1,
				status: "RECRUITING",
				createdAt: Date.now(),
				members: [{
					userId: user.id,
					nickname: user.nickname
				}]
			}, ...parties]);
		}, 1500);
	};
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "min-h-screen bg-slate-950 text-slate-100 font-sans antialiased selection:bg-amber-500 selection:text-slate-950",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("header", {
				className: "sticky top-0 z-40 backdrop-blur-md bg-slate-900/80 border-b border-slate-800",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "max-w-4xl mx-auto px-4 py-3 flex items-center justify-between",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex items-center gap-3",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "w-10 h-10 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-600 flex items-center justify-center text-xl shadow-lg shadow-amber-500/20",
							children: "☕"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
							className: "font-bold text-lg text-amber-400 leading-tight",
							children: "모여밥 2.0"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "text-xs text-slate-400 font-medium",
							children: "시흥캠 커피 & 디저트 배달비 0원 팟"
						})] })]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { children: user ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex items-center gap-3 bg-slate-800/80 border border-slate-700 px-3 py-1.5 rounded-full text-xs",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "w-2 h-2 rounded-full bg-emerald-400 animate-pulse" }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "font-semibold text-slate-200",
								children: user.nickname
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								onClick: handleLogout,
								className: "text-slate-400 hover:text-slate-200 transition-colors ml-1 underline",
								children: "로그아웃"
							})
						]
					}) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
						onClick: handleKakaoLogin,
						className: "bg-[#FEE500] hover:bg-[#FADA00] text-[#191919] font-bold text-xs px-4 py-2 rounded-full flex items-center gap-2 shadow-md hover:shadow-amber-500/10 transition-all transform active:scale-95 cursor-pointer",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("svg", {
							className: "w-4 h-4",
							viewBox: "0 0 24 24",
							fill: "currentColor",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M12 3c-4.97 0-9 3.185-9 7.115 0 2.557 1.707 4.8 4.27 6.054-.188.702-.682 2.545-.78 2.94-.12.486.178.477.375.347.155-.102 2.47-1.678 3.473-2.36.547.08 1.11.134 1.662.134 4.97 0 9-3.186 9-7.115S16.97 3 12 3z" })
						}), "카카오 1초 로그인"]
					}) })]
				})
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("main", {
				className: "max-w-4xl mx-auto px-4 py-6",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("section", {
						className: "relative overflow-hidden rounded-3xl bg-gradient-to-r from-amber-500/10 via-orange-500/10 to-amber-900/20 border border-amber-500/20 p-6 mb-8",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "relative z-10 max-w-xl",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-400/20 text-amber-300 border border-amber-400/30 mb-3",
									children: "⚡ 배민 함께주문 딥링크 연동"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("h2", {
									className: "text-2xl sm:text-3xl font-extrabold text-white mb-2 leading-tight",
									children: [
										"나른한 오후 2시! ",
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("br", {}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
											className: "text-transparent bg-clip-text bg-gradient-to-r from-amber-300 to-orange-400",
											children: "배달비 0원으로 커피 시키자"
										})
									]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									className: "text-sm text-slate-300 mb-5 leading-relaxed",
									children: "시흥캠 40인 눈치 없이 1초 익명 탑승 ➔ 총대의 배민 함께주문 링크로 각자 주문하고 결제하세요!"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "flex flex-wrap gap-3",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
										onClick: () => setActiveTab("parties"),
										className: "bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs px-4 py-2.5 rounded-xl shadow-lg shadow-amber-500/20 transition-all cursor-pointer",
										children: [
											"🔥 열려있는 커피 팟 보기 (",
											parties.length,
											"개)"
										]
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
										onClick: () => setActiveTab("cafes"),
										className: "bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs px-4 py-2.5 rounded-xl border border-slate-700 transition-all cursor-pointer",
										children: "☕ 새 커피 팟 만들기 ➕"
									})]
								})
							]
						})
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "flex items-center justify-between border-b border-slate-800 mb-6 pb-2",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex gap-2",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
									onClick: () => setActiveTab("parties"),
									className: `px-4 py-2.5 rounded-2xl text-xs font-bold transition-all cursor-pointer ${activeTab === "parties" ? "bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20" : "text-slate-400 hover:text-slate-200 hover:bg-slate-900"}`,
									children: [
										"🔥 실시간 커피 팟 (",
										parties.length,
										")"
									]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
									onClick: () => setActiveTab("cafes"),
									className: `px-4 py-2.5 rounded-2xl text-xs font-bold transition-all cursor-pointer ${activeTab === "cafes" ? "bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20" : "text-slate-400 hover:text-slate-200 hover:bg-slate-900"}`,
									children: [
										"🏬 인기 카페 탐색 (",
										cafes.length,
										")"
									]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
									onClick: () => setActiveTab("ai_upload"),
									className: `px-4 py-2.5 rounded-2xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${activeTab === "ai_upload" ? "bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20" : "text-slate-400 hover:text-slate-200 hover:bg-slate-900"}`,
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "📸 배민 캡처 AI 파싱" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "bg-orange-500 text-white text-[10px] px-1.5 py-0.5 rounded-md font-extrabold",
										children: "NEW"
									})]
								})
							]
						})
					}),
					activeTab === "parties" && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "grid grid-cols-1 md:grid-cols-2 gap-4",
						children: parties.map((party) => {
							const isJoined = party.members.some((m) => user && m.userId === user.id);
							const isHost = user && party.hostId === user.id;
							const remaining = party.targetCount - party.currentCount;
							const progressPercent = Math.min(100, Math.round(party.currentCount / party.targetCount * 100));
							return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: `rounded-2xl border p-5 transition-all relative flex flex-col justify-between ${party.status === "LINK_READY" ? "bg-gradient-to-b from-slate-900 via-slate-900 to-amber-950/30 border-amber-500/50 shadow-lg shadow-amber-500/10" : "bg-slate-900/80 border-slate-800 hover:border-slate-700"}`,
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "flex items-center justify-between mb-2",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
											className: "text-xs font-medium text-amber-400 bg-amber-500/10 px-2.5 py-1 rounded-lg border border-amber-500/20",
											children: party.cafeName.split(" ")[0]
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
											className: "text-xs font-semibold text-slate-400",
											children: [
												"⏰ ",
												party.targetTime,
												" 마감"
											]
										})]
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
										className: "text-base font-bold text-slate-100 mb-1",
										children: party.title
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
										className: "text-xs text-slate-400 mb-4 flex items-center gap-1.5",
										children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: ["👑 총대: ", /* @__PURE__ */ (0, import_jsx_runtime.jsx)("strong", {
											className: "text-slate-200",
											children: party.hostNickname
										})] })
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "bg-slate-950/60 p-3 rounded-xl border border-slate-800/80 mb-4",
										children: [
											/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
												className: "flex justify-between items-center text-xs mb-1.5",
												children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
													className: "font-semibold text-slate-300",
													children: [
														"모집 현황: ",
														/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
															className: "text-amber-400 font-bold",
															children: [party.currentCount, "명"]
														}),
														" / ",
														party.targetCount,
														"명"
													]
												}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
													className: "text-[11px] text-amber-300/80 font-medium",
													children: remaining > 0 ? `🚀 ${remaining}명 더 모이면 무료배달!` : "✅ 인원 달성완료!"
												})]
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
												className: "w-full bg-slate-800 rounded-full h-2 overflow-hidden",
												children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
													className: "bg-gradient-to-r from-amber-400 to-orange-500 h-full transition-all duration-500",
													style: { width: `${progressPercent}%` }
												})
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
												className: "flex flex-wrap gap-1.5 mt-3",
												children: party.members.map((m, idx) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
													className: `text-[11px] px-2 py-0.5 rounded-md ${m.userId === party.hostId ? "bg-amber-500/20 text-amber-300 font-bold border border-amber-500/30" : "bg-slate-800 text-slate-300"}`,
													children: m.nickname
												}, idx))
											})
										]
									})
								] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "space-y-2",
									children: [party.baeminLink ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("a", {
										href: party.baeminLink,
										target: "_blank",
										rel: "noopener noreferrer",
										className: "w-full bg-gradient-to-r from-amber-400 to-orange-500 hover:from-amber-300 hover:to-orange-400 text-slate-950 font-extrabold text-xs py-3 px-4 rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 transition-all active:scale-98 cursor-pointer",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("svg", {
											className: "w-4 h-4",
											fill: "none",
											stroke: "currentColor",
											viewBox: "0 0 24 24",
											children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", {
												strokeLinecap: "round",
												strokeLinejoin: "round",
												strokeWidth: "2.5",
												d: "M13 10V3L4 14h7v7l9-11h-7z"
											})
										}), "🚀 배민 함께주문으로 이동 후 담기"]
									}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
										className: "text-center py-2 bg-slate-950/40 rounded-xl text-xs text-slate-400 border border-slate-800",
										children: "⏳ 총대가 배민 함께주문 링크를 등록하는 중입니다..."
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "flex gap-2",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
											onClick: () => toggleJoinParty(party.id),
											className: `flex-1 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${isJoined ? "bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700" : "bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30"}`,
											children: isJoined ? isHost ? "👑 총대 (내 팟)" : "❌ 팟에서 내리기" : "🖐️ 1초 익명 탑승하기"
										}), isHost && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
											onClick: () => {
												setEditingPartyId(party.id);
												setInputBaeminLink(party.baeminLink || "");
											},
											className: "bg-orange-500/20 hover:bg-orange-500/30 text-orange-300 font-bold text-xs px-3 py-2.5 rounded-xl border border-orange-500/30 transition-all cursor-pointer",
											children: "📌 배민 링크 등록"
										})]
									})]
								})]
							}, party.id);
						})
					}),
					activeTab === "cafes" && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "space-y-6",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "grid grid-cols-1 md:grid-cols-2 gap-4",
							children: cafes.map((cafe) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "bg-slate-900/80 border border-slate-800 rounded-2xl p-5 hover:border-slate-700 transition-all",
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "flex items-start justify-between mb-3",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "flex items-center gap-3",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
												className: "text-3xl",
												children: cafe.visual
											}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
												className: "font-bold text-slate-100 text-base",
												children: cafe.name
											}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
												className: "text-xs text-slate-400",
												children: cafe.location
											})] })]
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
											className: "text-[11px] font-semibold text-amber-300 bg-amber-500/10 px-2 py-0.5 rounded-md border border-amber-500/20",
											children: cafe.badge
										})]
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "space-y-2 mb-4 bg-slate-950/40 p-3 rounded-xl border border-slate-800/80",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
											className: "text-[11px] font-bold text-slate-400 mb-1",
											children: "인기 대표 메뉴:"
										}), cafe.menus.map((menu) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "flex justify-between items-center text-xs text-slate-300 py-0.5",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
												className: "flex items-center gap-1.5",
												children: [
													/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: menu.visual }),
													/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: menu.name }),
													menu.popular && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
														className: "text-[10px] bg-red-500/20 text-red-300 px-1 rounded",
														children: "인기"
													})
												]
											}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
												className: "font-semibold text-slate-200",
												children: [menu.price.toLocaleString(), "원"]
											})]
										}, menu.id))]
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
										onClick: () => setSelectedCafeForParty(cafe),
										className: "w-full bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs py-2.5 px-4 rounded-xl transition-all shadow-md shadow-amber-500/10 cursor-pointer",
										children: "➕ 이 카페로 커피 팟 만들기"
									})
								]
							}, cafe.id))
						})
					}),
					activeTab === "ai_upload" && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "bg-slate-900/80 border border-slate-800 rounded-3xl p-6 text-center max-w-xl mx-auto",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "w-16 h-16 bg-amber-500/10 text-amber-400 rounded-3xl flex items-center justify-center text-3xl mx-auto mb-4 border border-amber-500/20",
								children: "📸"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
								className: "text-xl font-bold text-slate-100 mb-2",
								children: "배민 캡처 사진 올려서 팟 만들기"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
								className: "text-xs text-slate-400 mb-6 leading-relaxed",
								children: [
									"배민 앱에서 원하는 카페/메뉴 화면을 캡처해서 올려주시면, ",
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("br", {}),
									"AI가 카페 이름과 대표 메뉴를 1초 만에 파싱해서 팟을 만들어 줍니다!"
								]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "border-2 border-dashed border-slate-700 hover:border-amber-500/50 rounded-2xl p-8 mb-6 bg-slate-950/50 transition-all cursor-pointer group",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
									type: "file",
									accept: "image/*",
									onChange: handleAiCaptureUpload,
									className: "hidden",
									id: "ai_file_input"
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
									htmlFor: "ai_file_input",
									className: "cursor-pointer block",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
										className: "text-sm font-semibold text-slate-300 group-hover:text-amber-400 transition-colors",
										children: "📁 스크린샷 이미지 선택 또는 드래그 앤 드롭"
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
										className: "text-xs text-slate-500 mt-1",
										children: "PNG, JPG 캡처 이미지 지원"
									})]
								})]
							}),
							aiAnalyzing && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "py-4 text-amber-400 font-bold text-xs animate-pulse flex items-center justify-center gap-2",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "w-2 h-2 rounded-full bg-amber-400 animate-ping" }), "🤖 AI가 배민 캡처 이미지에서 카페 및 메뉴를 분석하고 있습니다..."]
							}),
							aiSuccess && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl text-emerald-400 font-bold text-xs mb-4",
								children: ["🎉 [AI 파싱 성공] 메가MGC커피 아샷추 팟이 자동으로 생성되었습니다!", /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
									onClick: () => setActiveTab("parties"),
									className: "ml-2 underline text-white font-extrabold",
									children: "팟 목록 확인 ➔"
								})]
							})
						]
					})
				]
			}),
			selectedCafeForParty && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "bg-slate-900 border border-slate-800 rounded-3xl p-6 w-full max-w-md shadow-2xl",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
							className: "text-lg font-bold text-slate-100 mb-1",
							children: "☕ 새 커피 팟 만들기"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "text-xs text-amber-400 mb-4",
							children: selectedCafeForParty.name
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("form", {
							onSubmit: handleCreateParty,
							className: "space-y-4",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
									className: "block text-xs font-semibold text-slate-300 mb-1",
									children: "팟 제목"
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
									type: "text",
									placeholder: "예: 14:00 메가커피 아샷추 팟",
									value: newPartyTitle,
									onChange: (e) => setNewPartyTitle(e.target.value),
									className: "w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-amber-500"
								})] }),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "grid grid-cols-2 gap-3",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
										className: "block text-xs font-semibold text-slate-300 mb-1",
										children: "마감 예상 시각"
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("select", {
										value: newPartyTime,
										onChange: (e) => setNewPartyTime(e.target.value),
										className: "w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-amber-500",
										children: [
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
												value: "13:30",
												children: "13:30"
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
												value: "14:00",
												children: "14:00"
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
												value: "14:30",
												children: "14:30"
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
												value: "15:00",
												children: "15:00"
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
												value: "15:30",
												children: "15:30"
											})
										]
									})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
										className: "block text-xs font-semibold text-slate-300 mb-1",
										children: "목표 인원"
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("select", {
										value: newPartyTargetCount,
										onChange: (e) => setNewPartyTargetCount(Number(e.target.value)),
										className: "w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-amber-500",
										children: [
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
												value: 3,
												children: "3명 (무료배달)"
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
												value: 4,
												children: "4명 (무료배달)"
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
												value: 5,
												children: "5명"
											})
										]
									})] })]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "flex gap-2 pt-2",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
										type: "button",
										onClick: () => setSelectedCafeForParty(null),
										className: "flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs py-2.5 rounded-xl transition-all cursor-pointer",
										children: "취소"
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
										type: "submit",
										className: "flex-1 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs py-2.5 rounded-xl transition-all shadow-md shadow-amber-500/20 cursor-pointer",
										children: "🚀 팟 생성하기"
									})]
								})
							]
						})
					]
				})
			}),
			editingPartyId && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "bg-slate-900 border border-slate-800 rounded-3xl p-6 w-full max-w-md shadow-2xl",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
							className: "text-lg font-bold text-slate-100 mb-1",
							children: "📌 배민 함께주문 링크 등록"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "text-xs text-slate-400 mb-4",
							children: "배민 앱에서 생성한 '함께주문 링크'를 아래에 붙여넣어주세요!"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "space-y-4",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
								className: "block text-xs font-semibold text-slate-300 mb-1",
								children: "배민 함께주문 URL"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
								type: "text",
								placeholder: "https://m.baemin.com/...",
								value: inputBaeminLink,
								onChange: (e) => setInputBaeminLink(e.target.value),
								className: "w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-amber-500"
							})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "flex gap-2",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
									onClick: () => setEditingPartyId(null),
									className: "flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs py-2.5 rounded-xl transition-all cursor-pointer",
									children: "취소"
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
									onClick: () => handleSaveBaeminLink(editingPartyId),
									className: "flex-1 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs py-2.5 rounded-xl transition-all shadow-md shadow-amber-500/20 cursor-pointer",
									children: "저장 및 딥링크 띄우기"
								})]
							})]
						})
					]
				})
			})
		]
	});
}
//#endregion
export { MoyeobapHome as default };
