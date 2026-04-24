import { useState, useEffect, useMemo } from 'react';
import { supabase } from './supabase';
import {
  X, Calendar, MapPin, List, CheckCircle, Clock, Users,
  TrendingUp, LayoutDashboard, ChevronLeft, ChevronRight,
  Search, Filter, Monitor, Tv, Mic, Video,
} from 'lucide-react';

// ─────────────────────────────────────────────
// 상수 / 초기 데이터
// ─────────────────────────────────────────────
const HOURS = Array.from({ length: 14 }, (_, i) => 9 + i); // 9 ~ 22
const WEEKDAYS = ['월', '화', '수', '목', '금', '토', '일'];

const ROOM_DETAILS = [
  {
    id: '다목적실',
    name: '다목적실',
    capacity: 10,
    equipment: { projector: true, whiteboard: true, tv: false, videoCall: true },
    location: '1층',
    description: '밝은 채광, 대형 강의실',
  },
  {
    id: '문화관',
    name: '문화관',
    capacity: 4,
    equipment: { projector: false, whiteboard: true, tv: true, videoCall: true },
    location: '1층',
    description: '대형 거울, 탈의실',
  },
  {
    id: '지하 회의실',
    name: '지하 회의실',
    capacity: 10,
    equipment: { projector: true, whiteboard: true, tv: true, videoCall: true },
    location: '지하 식당 옆 회의실',
    description: '지하 식당 옆 회의실',
  },
];

// 회의실 이름 → 상세정보 빠른 조회
const ROOM_MAP = Object.fromEntries(ROOM_DETAILS.map(r => [r.name, r]));
const ROOM_COLORS = { 다목적실: 'indigo', 문화관: 'violet', 지하회의실: 'sky' };

// ─────────────────────────────────────────────
// 유틸리티 함수
// ─────────────────────────────────────────────
const today = () => new Date().toISOString().split('T')[0];

const toYMD = (date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

/** 주어진 날짜가 속한 주의 월요일 날짜(YYYY-MM-DD) 반환 */
const getMonday = (dateStr) => {
  const d = new Date(dateStr);
  const day = d.getDay(); // 0=일, 1=월 …
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return toYMD(d);
};

/** 월요일로부터 7일 배열 반환 */
const getWeekDates = (mondayStr) => {
  const base = new Date(mondayStr);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(base);
    d.setDate(base.getDate() + i);
    return toYMD(d);
  });
};

const formatDate = (dateStr) => {
  const d = new Date(dateStr);
  const weekdays = ['일', '월', '화', '수', '목', '금', '토'];
  return `${d.getMonth() + 1}월 ${d.getDate()}일 (${weekdays[d.getDay()]})`;
};

const formatShortDate = (dateStr) => {
  const d = new Date(dateStr);
  return `${d.getMonth() + 1}/${d.getDate()}`;
};

/** 이번 주 월~일의 날짜 범위 문자열 */
const weekRangeLabel = (mondayStr) => {
  const dates = getWeekDates(mondayStr);
  return `${formatShortDate(dates[0])} ~ ${formatShortDate(dates[6])}`;
};

const dbToReservation = (row) => ({
  id: row.id,
  room: row.room,
  date: row.date,
  startHour: row.start_hour,
  endHour: row.end_hour,
  name: row.name,
  purpose: row.purpose,
  attendeeCount: row.attendee_count,
  createdAt: row.created_at,
});

// ─────────────────────────────────────────────
// 작은 UI 조각들
// ─────────────────────────────────────────────
const EquipmentBadge = ({ icon: Icon, label, active }) => (
  <span
    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${
      active
        ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
        : 'bg-gray-50 text-gray-400 border-gray-200 line-through'
    }`}
  >
    <Icon className="w-3 h-3" />
    {label}
  </span>
);

const RoomBadges = ({ roomName }) => {
  const detail = ROOM_MAP[roomName];
  if (!detail) return null;
  return (
    <div className="flex flex-wrap gap-1 mt-2">
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200">
        <Users className="w-3 h-3" />
        최대 {detail.capacity}명
      </span>
      <EquipmentBadge icon={Monitor} label="프로젝터" active={detail.equipment.projector} />
      <EquipmentBadge icon={Tv} label="TV" active={detail.equipment.tv} />
      <EquipmentBadge icon={Mic} label="화이트보드" active={detail.equipment.whiteboard} />
      <EquipmentBadge icon={Video} label="화상회의" active={detail.equipment.videoCall} />
    </div>
  );
};

const ProgressBar = ({ value, max, color = 'indigo' }) => {
  const pct = max === 0 ? 0 : Math.min(100, Math.round((value / max) * 100));
  const colorClass = {
    indigo: 'bg-indigo-500',
    violet: 'bg-violet-500',
    sky: 'bg-sky-500',
    green: 'bg-green-500',
  }[color] || 'bg-indigo-500';
  return (
    <div className="w-full bg-gray-200 rounded-full h-2">
      <div
        className={`${colorClass} h-2 rounded-full transition-all duration-500`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
};

// ─────────────────────────────────────────────
// 메인 컴포넌트
// ─────────────────────────────────────────────
export default function MeetingRoomReservation() {
  const rooms = ROOM_DETAILS.map(r => r.name);

  // ── 핵심 데이터 ──
  const [reservations, setReservations] = useState([]);

  // ── 탭 ──
  const [activeTab, setActiveTab] = useState('dashboard'); // 'dashboard' | 'calendar' | 'list'

  // ── 예약 폼 ──
  const [selectedDate, setSelectedDate] = useState(today());
  const [selectedRoom, setSelectedRoom] = useState(rooms[0]);
  const [startHour, setStartHour] = useState(9);
  const [endHour, setEndHour] = useState(10);
  const [showForm, setShowForm] = useState(false);
  const [showFormMobile, setShowFormMobile] = useState(false);
  const [formData, setFormData] = useState({ name: '', purpose: '' });
  const [attendeeCount, setAttendeeCount] = useState(1);

  // ── 타임라인 뷰 (일별) ──
  const [hoveredReservation, setHoveredReservation] = useState(null);
  const [tooltipPos, setTooltipPos] = useState(null);

  // ── 주간 뷰 ──
  const [viewMode, setViewMode] = useState('daily'); // 'daily' | 'weekly'
  const [weekStartDate, setWeekStartDate] = useState(getMonday(today()));
  const [activeWeekRoom, setActiveWeekRoom] = useState(rooms[0]);

  // ── 성공 모달 ──
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [lastReservation, setLastReservation] = useState(null);

  // ── 회의실 상세 모달 ──
  const [showRoomModal, setShowRoomModal] = useState(false);
  const [selectedRoomDetail, setSelectedRoomDetail] = useState(null);

  // ── 예약 목록 필터 ──
  const [filterParams, setFilterParams] = useState({
    searchQuery: '',
    rooms: ['다목적실', '문화관', '지하 회의실'],
    startDate: '',
    endDate: '',
  });

  // Supabase: 초기 데이터 불러오기 + 실시간 구독
  useEffect(() => {
    // 최초 로드
    supabase.from('reservations').select('*').then(({ data }) => {
      if (data) setReservations(data.map(dbToReservation));
    });

    // 실시간: 다른 사람이 예약/취소하면 즉시 반영
    const channel = supabase
      .channel('reservations')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'reservations' }, () => {
        supabase.from('reservations').select('*').then(({ data }) => {
          if (data) setReservations(data.map(dbToReservation));
        });
      })
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, []);

  // ─────────────────────────────────────────────
  // 파생 상태
  // ─────────────────────────────────────────────
  const currentRoomDetail = ROOM_MAP[selectedRoom];
  const maxCapacity = currentRoomDetail?.capacity ?? 10;

  const isTimeRangeAvailable = (room, date, start, end) =>
    !reservations.some(
      r => r.room === room && r.date === date && !(r.endHour <= start || r.startHour >= end)
    );

  const canReserve =
    isTimeRangeAvailable(selectedRoom, selectedDate, startHour, endHour) && startHour < endHour;

  const filteredByDate = reservations.filter(r => r.date === selectedDate);

  const weekDates = useMemo(() => getWeekDates(weekStartDate), [weekStartDate]);

  // 예약 목록 필터링
  const filteredList = useMemo(() => {
    return [...reservations]
      .filter(r => {
        const matchName = filterParams.searchQuery
          ? r.name.includes(filterParams.searchQuery)
          : true;
        const matchRoom = filterParams.rooms.includes(r.room);
        const matchStart = filterParams.startDate ? r.date >= filterParams.startDate : true;
        const matchEnd = filterParams.endDate ? r.date <= filterParams.endDate : true;
        return matchName && matchRoom && matchStart && matchEnd;
      })
      .sort((a, b) => a.date.localeCompare(b.date) || a.startHour - b.startHour);
  }, [reservations, filterParams]);

  // 대시보드 통계
  const dashboardStats = useMemo(() => {
    const todayStr = today();
    const todayRes = reservations.filter(r => r.date === todayStr);
    const totalHours = todayRes.reduce((s, r) => s + (r.endHour - r.startHour), 0);

    const roomCount = {};
    todayRes.forEach(r => { roomCount[r.room] = (roomCount[r.room] || 0) + 1; });
    const topRoom = Object.entries(roomCount).sort((a, b) => b[1] - a[1])[0]?.[0] ?? '-';

    // 이번 주 각 회의실 이용률
    const monday = getMonday(todayStr);
    const weekDatesArr = getWeekDates(monday);
    const weeklyUsage = ROOM_DETAILS.map(rd => {
      const weekRes = reservations.filter(
        r => r.room === rd.name && weekDatesArr.includes(r.date)
      );
      const usedHours = weekRes.reduce((s, r) => s + (r.endHour - r.startHour), 0);
      // 주 5일 × 9시간 기준
      const maxHours = 5 * 13;
      return { name: rd.name, usedHours, pct: Math.round((usedHours / maxHours) * 100) };
    });

    // 다음 예정 예약 (오늘 이후, 최대 5건)
    const upcoming = [...reservations]
      .filter(r => r.date > todayStr || (r.date === todayStr && r.startHour > new Date().getHours()))
      .sort((a, b) => a.date.localeCompare(b.date) || a.startHour - b.startHour)
      .slice(0, 5);

    return { todayCount: todayRes.length, totalHours, topRoom, weeklyUsage, upcoming };
  }, [reservations]);

  // ─────────────────────────────────────────────
  // 핸들러
  // ─────────────────────────────────────────────
  const handleReserve = async () => {
    if (!formData.name || !formData.purpose) {
      alert('예약자명과 사용목적을 입력해주세요.');
      return;
    }
    if (attendeeCount < 1 || attendeeCount > maxCapacity) {
      alert(`참석자 수는 1명 이상 ${maxCapacity}명 이하여야 합니다.`);
      return;
    }

    const { data, error } = await supabase.from('reservations').insert({
      room: selectedRoom,
      date: selectedDate,
      start_hour: startHour,
      end_hour: endHour,
      name: formData.name,
      purpose: formData.purpose,
      attendee_count: attendeeCount,
    }).select().single();

    if (error) { alert('예약 중 오류가 발생했습니다.'); return; }

    const newReservation = dbToReservation(data);
    setReservations(prev => [...prev, newReservation]);
    setLastReservation(newReservation);
    setShowSuccessModal(true);
    setFormData({ name: '', purpose: '' });
    setAttendeeCount(1);
    setShowForm(false);

    setTimeout(() => setShowSuccessModal(false), 3000);
  };

  const handleCancel = async (id) => {
    const { error } = await supabase.from('reservations').delete().eq('id', id);
    if (error) {
      alert('취소 중 오류가 발생했습니다.');
    } else {
      setReservations(prev => prev.filter(r => r.id !== id));
    }
  };

  const handleMouseEnter = (reservation, e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setTooltipPos({ top: rect.top - 10, left: rect.left + rect.width / 2 });
    setHoveredReservation(reservation);
  };

  const handleMouseLeave = () => setHoveredReservation(null);

  const handleWeekCellClick = (date, hour) => {
    setSelectedDate(date);
    setStartHour(hour);
    setEndHour(Math.min(hour + 1, 22));
    setSelectedRoom(activeWeekRoom);
    // 예약 현황 탭으로 이동하고 일별 뷰 + 폼 표시
    setViewMode('daily');
    setActiveTab('calendar');
    setShowForm(true);
  };

  const prevWeek = () => {
    const d = new Date(weekStartDate);
    d.setDate(d.getDate() - 7);
    setWeekStartDate(toYMD(d));
  };

  const nextWeek = () => {
    const d = new Date(weekStartDate);
    d.setDate(d.getDate() + 7);
    setWeekStartDate(toYMD(d));
  };

  const openRoomModal = (roomName) => {
    setSelectedRoomDetail(ROOM_MAP[roomName]);
    setShowRoomModal(true);
  };

  const resetFilter = () => {
    setFilterParams({ searchQuery: '', rooms: [...rooms], startDate: '', endDate: '' });
  };

  const toggleFilterRoom = (room) => {
    setFilterParams(prev => ({
      ...prev,
      rooms: prev.rooms.includes(room)
        ? prev.rooms.filter(r => r !== room)
        : [...prev.rooms, room],
    }));
  };


  // ─────────────────────────────────────────────
  // 렌더 헬퍼: 타임라인 블록 공통
  // ─────────────────────────────────────────────
  const renderTimelineBlock = (reservation, showTooltip = true) => {
    const startPct = ((reservation.startHour - 9) / 13) * 100;
    const widthPct = ((reservation.endHour - reservation.startHour) / 13) * 100;
    const c = ROOM_COLORS[reservation.room];

    return (
      <div
        key={reservation.id}
        onMouseEnter={(e) => showTooltip && handleMouseEnter(reservation, e)}
        onMouseLeave={() => showTooltip && handleMouseLeave()}
        className={`absolute top-1 bottom-1 bg-${c}-500 hover:bg-${c}-600 rounded-md flex items-center justify-center cursor-pointer transition`}
        style={{ left: `${startPct}%`, width: `${widthPct}%` }}
      >
        <span className="text-white font-bold text-xs truncate px-2">
          {reservation.startHour}~{reservation.endHour}
        </span>
        {showTooltip && hoveredReservation?.id === reservation.id && tooltipPos && (
          <div
            className="fixed z-50 bg-gray-800 text-white rounded-lg px-3 py-2 text-xs whitespace-nowrap -translate-x-1/2"
            style={{ top: `${tooltipPos.top - 48}px`, left: `${tooltipPos.left}px` }}
          >
            <div className="font-bold">{reservation.name}</div>
            <div className="text-gray-300">{reservation.purpose}</div>
            {reservation.attendeeCount && (
              <div className="text-gray-400">참석자 {reservation.attendeeCount}명</div>
            )}
            <div className="text-gray-400 mt-1">
              {reservation.startHour}:00 ~ {reservation.endHour}:00
            </div>
            <button
              onClick={() => handleCancel(reservation.id)}
              className="absolute top-1 right-1 text-red-400 hover:text-red-300"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    );
  };

  // ─────────────────────────────────────────────
  // 렌더: 예약 폼 (사이드바)
  // ─────────────────────────────────────────────
  const renderForm = () => (
    <div className="bg-white rounded-xl shadow-lg p-4 md:p-6 sticky top-8">
      <h2 className="text-xl font-bold text-gray-800 mb-4">예약하기</h2>

      {/* 날짜 */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-1">날짜</label>
        <input
          type="date"
          value={selectedDate}
          min={today()}
          onChange={(e) => setSelectedDate(e.target.value)}
          className="w-auto border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm box-border"
        />
        <p className="text-xs text-gray-500 mt-1">{formatDate(selectedDate)}</p>
      </div>

      {/* 회의실 선택 */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-1">회의실</label>
        <div className="flex gap-1">
          <select
            value={selectedRoom}
            onChange={(e) => {
              setSelectedRoom(e.target.value);
              setAttendeeCount(1);
            }}
            className="flex-1 border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
          >
            {rooms.map(room => (
              <option key={room} value={room}>{room}</option>
            ))}
          </select>
          <button
            onClick={() => openRoomModal(selectedRoom)}
            className="px-3 py-2 text-xs bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-lg transition border border-gray-200 whitespace-nowrap"
          >
            상세보기
          </button>
        </div>
        {/* 선택된 회의실 정보 뱃지 */}
        <RoomBadges roomName={selectedRoom} />
      </div>

      {/* 시작 / 종료 시간 */}
      <div className="grid grid-cols-2 gap-2 mb-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">시작</label>
          <select
            value={startHour}
            onChange={(e) => {
              const v = parseInt(e.target.value);
              setStartHour(v);
              if (v >= endHour) setEndHour(v + 1);
            }}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
          >
            {HOURS.map(h => <option key={h} value={h}>{h}:00</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">종료</label>
          <select
            value={endHour}
            onChange={(e) => setEndHour(parseInt(e.target.value))}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
          >
            {HOURS.map(h => (
              <option key={h} value={h} disabled={h <= startHour}>
                {h}:00{h <= startHour ? ' (불가)' : ''}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* 시간 요약 */}
      <div className="mb-4 p-3 bg-indigo-50 rounded-lg">
        <p className="text-sm text-gray-600">
          <span className="font-medium">{startHour}:00 ~ {endHour}:00</span>
          &nbsp;
          <span className="text-indigo-600 font-medium">({endHour - startHour}시간)</span>
        </p>
      </div>

      {/* 충돌 경고 */}
      {!canReserve && startHour < endHour && (
        <div className="mb-4 p-2 bg-red-50 text-red-700 text-xs rounded-lg border border-red-200">
          해당 시간대는 이미 예약되어 있습니다.
        </div>
      )}

      {/* 예약 진행 / 상세 폼 */}
      {!showForm ? (
        <button
          onClick={() => setShowForm(true)}
          disabled={!canReserve}
          className="w-full bg-indigo-600 text-white py-2 rounded-lg font-medium hover:bg-indigo-700 transition disabled:bg-gray-300 disabled:cursor-not-allowed text-sm"
        >
          예약 진행
        </button>
      ) : (
        <div className="space-y-3">
          <input
            type="text"
            placeholder="예약자명"
            value={formData.name}
            onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />

          {/* 참석자 수 */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-sm font-medium text-gray-700">참석자 수</label>
              <span className="text-xs text-gray-400">최대 {maxCapacity}명</span>
            </div>
            <input
              type="number"
              min={1}
              max={maxCapacity}
              value={attendeeCount}
              onChange={(e) => setAttendeeCount(parseInt(e.target.value) || 1)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            {attendeeCount > maxCapacity && (
              <p className="text-xs text-yellow-600 mt-1 flex items-center gap-1">
                <span>수용인원({maxCapacity}명)을 초과했습니다.</span>
              </p>
            )}
          </div>

          <textarea
            placeholder="사용목적"
            value={formData.purpose}
            onChange={(e) => setFormData(prev => ({ ...prev, purpose: e.target.value }))}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none h-20"
          />
          <div className="flex gap-2">
            <button
              onClick={handleReserve}
              className="flex-1 bg-green-600 text-white py-2 rounded-lg font-medium hover:bg-green-700 transition text-sm"
            >
              확정
            </button>
            <button
              onClick={() => setShowForm(false)}
              className="flex-1 bg-gray-200 text-gray-700 py-2 rounded-lg font-medium hover:bg-gray-300 transition text-sm"
            >
              취소
            </button>
          </div>
        </div>
      )}
    </div>
  );

  // ─────────────────────────────────────────────
  // 렌더: 대시보드 탭
  // ─────────────────────────────────────────────
  const renderDashboard = () => (
    <div className="space-y-6">
      {/* 오늘의 요약 카드 */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl shadow p-5 flex items-center gap-4">
          <div className="p-3 bg-indigo-100 rounded-xl">
            <Calendar className="w-6 h-6 text-indigo-600" />
          </div>
          <div>
            <p className="text-sm text-gray-500">오늘 예약 건수</p>
            <p className="text-2xl font-bold text-gray-800">{dashboardStats.todayCount}건</p>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow p-5 flex items-center gap-4">
          <div className="p-3 bg-green-100 rounded-xl">
            <Clock className="w-6 h-6 text-green-600" />
          </div>
          <div>
            <p className="text-sm text-gray-500">오늘 총 이용 시간</p>
            <p className="text-2xl font-bold text-gray-800">{dashboardStats.totalHours}시간</p>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow p-5 flex items-center gap-4">
          <div className="p-3 bg-violet-100 rounded-xl">
            <TrendingUp className="w-6 h-6 text-violet-600" />
          </div>
          <div>
            <p className="text-sm text-gray-500">오늘 최다 이용</p>
            <p className="text-2xl font-bold text-gray-800">{dashboardStats.topRoom}</p>
          </div>
        </div>
      </div>

      {/* 이번 주 이용률 */}
      <div className="bg-white rounded-xl shadow p-5">
        <h3 className="text-base font-bold text-gray-800 mb-4 flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-indigo-600" />
          이번 주 회의실별 이용률
          <span className="text-xs text-gray-400 font-normal ml-1">(주 5일 × 9시간 기준)</span>
        </h3>
        <div className="space-y-4">
          {dashboardStats.weeklyUsage.map(({ name, usedHours, pct }) => {
            const colorKey = { A회의실: 'indigo', B회의실: 'violet', C회의실: 'sky' }[name];
            return (
              <div key={name}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium text-gray-700">{name}</span>
                  <span className="text-sm text-gray-500">{usedHours}h / 45h ({pct}%)</span>
                </div>
                <ProgressBar value={usedHours} max={45} color={colorKey} />
              </div>
            );
          })}
        </div>
      </div>

      {/* 다음 예정 예약 */}
      <div className="bg-white rounded-xl shadow p-5">
        <h3 className="text-base font-bold text-gray-800 mb-4 flex items-center gap-2">
          <Clock className="w-5 h-5 text-indigo-600" />
          다음 예정 예약
        </h3>
        {dashboardStats.upcoming.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-4">예정된 예약이 없습니다.</p>
        ) : (
          <div className="space-y-3">
            {dashboardStats.upcoming.map(r => {
              const c = ROOM_COLORS[r.room];
              return (
                <div
                  key={r.id}
                  className={`flex items-center gap-3 p-3 rounded-lg bg-${c}-50 border border-${c}-100`}
                >
                  <div className={`w-2 h-10 rounded-full bg-${c}-500 shrink-0`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`font-bold text-sm text-${c}-700`}>{r.room}</span>
                      <span className="text-xs text-gray-500">{formatDate(r.date)}</span>
                    </div>
                    <div className="text-xs text-gray-600 truncate">
                      {r.startHour}:00 ~ {r.endHour}:00 · {r.name} · {r.purpose}
                    </div>
                  </div>
                  {r.attendeeCount && (
                    <div className="shrink-0 flex items-center gap-1 text-xs text-gray-500">
                      <Users className="w-3 h-3" />
                      {r.attendeeCount}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );

  // ─────────────────────────────────────────────
  // 렌더: 일별 타임라인
  // ─────────────────────────────────────────────
  const renderDailyTimeline = () => (
    <div className="bg-white rounded-xl shadow-lg p-5 overflow-x-auto">
      <h2 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
        <MapPin className="w-5 h-5 text-indigo-600" />
        예약 현황 — {formatDate(selectedDate)}
      </h2>

      {/* 시간 헤더 */}
      <div className="flex mb-1 pl-24">
        {HOURS.map(h => (
          <div key={h} className="flex-1 text-center text-xs text-gray-500 font-medium">{h}</div>
        ))}
      </div>

      <div className="space-y-3">
        {rooms.map(room => {
          const c = ROOM_COLORS[room];
          return (
            <div key={room} className="flex items-center gap-3">
              <div className="w-24 shrink-0 text-right">
                <button
                  onClick={() => openRoomModal(room)}
                  className={`text-xs font-semibold text-${c}-700 hover:underline`}
                >
                  {room}
                </button>
              </div>
              <div className="relative flex-1 bg-gray-100 rounded-lg h-12 border border-gray-200">
                {/* 시간 눈금 */}
                <div className="absolute inset-0 flex">
                  {HOURS.map(h => (
                    <div key={h} className="flex-1 border-r border-gray-200 last:border-r-0" />
                  ))}
                </div>
                {/* 예약 블록 */}
                {filteredByDate
                  .filter(r => r.room === room)
                  .map(r => renderTimelineBlock(r))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );

  // ─────────────────────────────────────────────
  // 렌더: 주간 뷰
  // ─────────────────────────────────────────────
  const renderWeeklyView = () => {
    const weekRes = reservations.filter(
      r => r.room === activeWeekRoom && weekDates.includes(r.date)
    );
    const c = ROOM_COLORS[activeWeekRoom];

    return (
      <div className="bg-white rounded-xl shadow-lg p-5 overflow-x-auto w-full">
        {/* 헤더: 회의실 탭 + 주 네비게이션 */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-5">
          <div className="flex gap-1">
            {rooms.map(room => {
              const rc = ROOM_COLORS[room];
              const isActive = room === activeWeekRoom;
              return (
                <button
                  key={room}
                  onClick={() => setActiveWeekRoom(room)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${
                    isActive
                      ? `bg-${rc}-600 text-white`
                      : `bg-gray-100 text-gray-600 hover:bg-gray-200`
                  }`}
                >
                  {room}
                </button>
              );
            })}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={prevWeek}
              className="p-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 transition"
            >
              <ChevronLeft className="w-4 h-4 text-gray-600" />
            </button>
            <span className="text-sm font-medium text-gray-700 min-w-32 text-center">
              {weekRangeLabel(weekStartDate)}
            </span>
            <button
              onClick={nextWeek}
              className="p-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 transition"
            >
              <ChevronRight className="w-4 h-4 text-gray-600" />
            </button>
          </div>
        </div>

        {/* 그리드 */}
        <div className="min-w-[600px]">
          {/* 요일 헤더 */}
          <div className="flex">
            <div className="w-12 shrink-0" />
            {weekDates.map((date, i) => {
              const isToday = date === today();
              return (
                <div
                  key={date}
                  className={`flex-1 text-center pb-2 border-b-2 ${
                    isToday ? `border-${c}-500` : 'border-gray-200'
                  }`}
                >
                  <div className={`text-xs font-semibold ${isToday ? `text-${c}-600` : 'text-gray-500'}`}>
                    {WEEKDAYS[i]}
                  </div>
                  <div className={`text-sm font-bold ${isToday ? `text-${c}-700` : 'text-gray-700'}`}>
                    {formatShortDate(date)}
                  </div>
                </div>
              );
            })}
          </div>

          {/* 시간 × 날짜 그리드 */}
          {HOURS.map(hour => (
            <div key={hour} className="flex border-b border-gray-100">
              <div className="w-12 shrink-0 text-xs text-gray-400 pt-1 pr-2 text-right">
                {hour}:00
              </div>
              {weekDates.map(date => {
                const cellRes = weekRes.filter(
                  r => r.date === date && r.startHour <= hour && r.endHour > hour
                );
                const isAvailable = isTimeRangeAvailable(activeWeekRoom, date, hour, hour + 1);
                return (
                  <div
                    key={date}
                    onClick={() => isAvailable && handleWeekCellClick(date, hour)}
                    className={`flex-1 h-10 border-l border-gray-100 transition ${
                      cellRes.length > 0
                        ? ''
                        : isAvailable
                        ? 'hover:bg-indigo-50 cursor-pointer'
                        : 'cursor-default'
                    }`}
                  >
                    {cellRes.length > 0 ? (
                      cellRes.map(r => {
                        // 블록 시작 행에서만 라벨 표시
                        const isFirstRow = r.startHour === hour;
                        return (
                          <div
                            key={r.id}
                            className={`h-full bg-${c}-500 flex items-center px-1 relative group`}
                          >
                            {isFirstRow && (
                              <span className="text-white text-xs truncate font-medium">
                                {r.name}
                              </span>
                            )}
                            <button
                              onClick={(e) => { e.stopPropagation(); handleCancel(r.id); }}
                              className="absolute top-0.5 right-0.5 hidden group-hover:flex text-white/70 hover:text-white"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        );
                      })
                    ) : null}
                  </div>
                );
              })}
            </div>
          ))}
        </div>

        <p className="text-xs text-gray-400 mt-3">
          빈 칸을 클릭하면 해당 날짜/시간이 예약 폼에 자동 입력됩니다.
        </p>
      </div>
    );
  };

  // ─────────────────────────────────────────────
  // 렌더: 예약 목록 탭
  // ─────────────────────────────────────────────
  const renderList = () => (
    <div className="bg-white rounded-xl shadow-lg p-5">
      <h2 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
        <List className="w-5 h-5 text-indigo-600" />
        전체 예약 목록
        <span className="text-sm text-gray-400 font-normal ml-1">({filteredList.length}건)</span>
      </h2>

      {/* 필터 영역 */}
      <div className="bg-gray-50 rounded-xl p-4 mb-5 space-y-3 border border-gray-200">
        <div className="flex items-center gap-2 text-sm font-medium text-gray-600 mb-1">
          <Filter className="w-4 h-4" />
          검색 / 필터
        </div>

        {/* 예약자명 검색 */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="예약자명으로 검색"
            value={filterParams.searchQuery}
            onChange={(e) => setFilterParams(prev => ({ ...prev, searchQuery: e.target.value }))}
            className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        {/* 회의실 토글 */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-gray-500">회의실:</span>
          {rooms.map(room => {
            const active = filterParams.rooms.includes(room);
            const c = ROOM_COLORS[room];
            return (
              <button
                key={room}
                onClick={() => toggleFilterRoom(room)}
                className={`px-3 py-1 rounded-full text-xs font-medium border transition ${
                  active
                    ? `bg-${c}-100 text-${c}-700 border-${c}-300`
                    : 'bg-white text-gray-400 border-gray-300'
                }`}
              >
                {room}
              </button>
            );
          })}
        </div>

        {/* 날짜 범위 */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-gray-500">날짜 범위:</span>
          <input
            type="date"
            value={filterParams.startDate}
            onChange={(e) => setFilterParams(prev => ({ ...prev, startDate: e.target.value }))}
            className="border border-gray-300 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <span className="text-gray-400">~</span>
          <input
            type="date"
            value={filterParams.endDate}
            onChange={(e) => setFilterParams(prev => ({ ...prev, endDate: e.target.value }))}
            className="border border-gray-300 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <button
            onClick={resetFilter}
            className="px-3 py-1.5 text-xs bg-gray-200 hover:bg-gray-300 text-gray-600 rounded-lg transition"
          >
            초기화
          </button>
        </div>
      </div>

      {/* 목록 */}
      {filteredList.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <Calendar className="w-12 h-12 mx-auto mb-3 text-gray-300" />
          <p>조건에 맞는 예약이 없습니다.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredList.map(r => {
            const c = ROOM_COLORS[r.room];
            return (
              <div
                key={r.id}
                className={`border border-gray-200 rounded-xl p-4 hover:shadow-md transition flex flex-col md:flex-row md:items-center md:justify-between gap-3`}
              >
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  <div className={`w-1.5 h-full min-h-12 rounded-full bg-${c}-500 shrink-0 self-stretch`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className={`font-bold text-${c}-700`}>{r.room}</span>
                      <span className="text-sm text-gray-500">{formatDate(r.date)}</span>
                      {r.attendeeCount && (
                        <span className="inline-flex items-center gap-1 text-xs text-gray-500">
                          <Users className="w-3 h-3" />
                          {r.attendeeCount}명
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1 text-sm text-gray-600 mb-1">
                      <Clock className="w-4 h-4 shrink-0" />
                      {r.startHour}:00 ~ {r.endHour}:00
                      <span className="text-gray-400 ml-1">({r.endHour - r.startHour}시간)</span>
                    </div>
                    <div className="text-sm text-gray-700">
                      <span className="font-medium">예약자:</span> {r.name}
                    </div>
                    <div className="text-sm text-gray-600 truncate">
                      <span className="font-medium text-gray-700">목적:</span> {r.purpose}
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => {
                    if (window.confirm('정말 이 예약을 취소하시겠습니까?')) handleCancel(r.id);
                  }}
                  className="shrink-0 px-4 py-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition text-sm font-medium flex items-center gap-1 border border-red-100"
                >
                  <X className="w-4 h-4" />
                  취소
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );

  // ─────────────────────────────────────────────
  // 렌더: 회의실 상세 모달
  // ─────────────────────────────────────────────
  const renderRoomModal = () => {
    if (!showRoomModal || !selectedRoomDetail) return null;
    const d = selectedRoomDetail;
    const c = ROOM_COLORS[d.name];
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-md w-full">
          <div className="flex items-center justify-between mb-5">
            <h3 className="text-xl font-bold text-gray-800">{d.name}</h3>
            <button
              onClick={() => setShowRoomModal(false)}
              className="p-1.5 rounded-lg hover:bg-gray-100 transition"
            >
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-gray-600">
              <MapPin className={`w-4 h-4 text-${c}-600`} />
              <span className="text-sm">{d.location}</span>
            </div>
            <div className="flex items-center gap-2 text-gray-600">
              <Users className={`w-4 h-4 text-${c}-600`} />
              <span className="text-sm">수용인원 <strong>{d.capacity}명</strong></span>
            </div>
            <div className="text-sm text-gray-600 bg-gray-50 rounded-lg px-3 py-2">
              {d.description}
            </div>
            <div>
              <p className="text-sm font-medium text-gray-700 mb-2">장비</p>
              <div className="flex flex-wrap gap-2">
                <EquipmentBadge icon={Monitor} label="프로젝터" active={d.equipment.projector} />
                <EquipmentBadge icon={Tv} label="TV" active={d.equipment.tv} />
                <EquipmentBadge icon={Mic} label="화이트보드" active={d.equipment.whiteboard} />
                <EquipmentBadge icon={Video} label="화상회의" active={d.equipment.videoCall} />
              </div>
            </div>
          </div>
          <button
            onClick={() => setShowRoomModal(false)}
            className={`mt-6 w-full bg-${c}-600 text-white py-2.5 rounded-xl font-medium hover:bg-${c}-700 transition`}
          >
            닫기
          </button>
        </div>
      </div>
    );
  };

  // ─────────────────────────────────────────────
  // 렌더: 성공 모달
  // ─────────────────────────────────────────────
  const renderSuccessModal = () => {
    if (!showSuccessModal || !lastReservation) return null;
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-md w-full">
          <div className="flex items-center gap-3 mb-4">
            <CheckCircle className="w-8 h-8 text-green-500" />
            <h3 className="text-xl font-bold text-gray-800">예약 완료!</h3>
          </div>
          <div className="space-y-2 text-sm text-gray-600 mb-5">
            <p><span className="font-medium text-gray-700">회의실:</span> {lastReservation.room}</p>
            <p><span className="font-medium text-gray-700">날짜:</span> {formatDate(lastReservation.date)}</p>
            <p>
              <span className="font-medium text-gray-700">시간:</span>{' '}
              {lastReservation.startHour}:00 ~ {lastReservation.endHour}:00
            </p>
            <p><span className="font-medium text-gray-700">예약자:</span> {lastReservation.name}</p>
            {lastReservation.attendeeCount && (
              <p><span className="font-medium text-gray-700">참석자:</span> {lastReservation.attendeeCount}명</p>
            )}
            <p><span className="font-medium text-gray-700">사용목적:</span> {lastReservation.purpose}</p>
          </div>
          <button
            onClick={() => setShowSuccessModal(false)}
            className="w-full bg-indigo-600 text-white py-2.5 rounded-xl font-medium hover:bg-indigo-700 transition"
          >
            확인
          </button>
        </div>
      </div>
    );
  };

  // ─────────────────────────────────────────────
  // 메인 렌더
  // ─────────────────────────────────────────────
  const TAB_META = [
    { id: 'dashboard', label: '대시보드', Icon: LayoutDashboard },
    { id: 'calendar', label: '예약 현황', Icon: Calendar },
    { id: 'list', label: '예약 목록', Icon: List },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4 md:p-8 overflow-x-hidden">
      <div className="max-w-7xl mx-auto">
        {/* 헤더 */}
        <div className="mb-6">
          <h1 className="text-3xl md:text-4xl font-bold text-gray-800 mb-1 flex items-center gap-2">
            <Calendar className="w-8 h-8 text-indigo-600" />
            회의실 예약 시스템
          </h1>
          <p className="text-gray-500 text-sm">회의실과 시간 범위를 선택하여 예약하세요</p>
        </div>

        {/* 탭 메뉴 */}
        <div className="mb-6 flex gap-1 border-b border-gray-300">
          {TAB_META.map(({ id, label, Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium transition border-b-2 -mb-px ${
                activeTab === id
                  ? 'text-indigo-600 border-indigo-600'
                  : 'text-gray-500 border-transparent hover:text-gray-700'
              }`}
            >
              <Icon className="w-4 h-4" />
              {label}
            </button>
          ))}
        </div>

        {/* 대시보드 */}
        {activeTab === 'dashboard' && renderDashboard()}

        {/* 예약 현황 (일별 + 주간) */}
        {activeTab === 'calendar' && (
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            {/* 예약 폼 사이드바 */}
            <div className="order-2 lg:order-1 lg:col-span-1">
              {/* 모바일 전용 토글 버튼 */}
              <button
                className="block lg:hidden w-full mb-3 py-2 px-4 bg-indigo-600 text-white text-sm font-medium rounded-lg"
                onClick={() => setShowFormMobile(prev => !prev)}
              >
                {showFormMobile ? '폼 닫기' : '예약하기'}
              </button>
              {/* 데스크탑: 항상 표시 / 모바일: 토글에 따라 표시 */}
              <div className={showFormMobile ? 'block' : 'hidden lg:block'}>
                {renderForm()}
              </div>
            </div>

            {/* 타임라인 영역 */}
            <div className="order-1 lg:order-2 lg:col-span-3 space-y-4">
              {/* 일별 / 주간 토글 */}
              <div className="flex items-center gap-2">
                <div className="flex bg-white rounded-lg shadow p-1 gap-1">
                  <button
                    onClick={() => setViewMode('daily')}
                    className={`px-3 py-1.5 rounded-md text-sm font-medium transition ${
                      viewMode === 'daily'
                        ? 'bg-indigo-600 text-white'
                        : 'text-gray-500 hover:bg-gray-100'
                    }`}
                  >
                    일별
                  </button>
                  <button
                    onClick={() => setViewMode('weekly')}
                    className={`px-3 py-1.5 rounded-md text-sm font-medium transition ${
                      viewMode === 'weekly'
                        ? 'bg-indigo-600 text-white'
                        : 'text-gray-500 hover:bg-gray-100'
                    }`}
                  >
                    주간
                  </button>
                </div>

                {/* 일별 뷰일 때 날짜 네비게이션 */}
                {viewMode === 'daily' && (
                  <div className="flex items-center gap-1 bg-white rounded-lg shadow p-1">
                    <button
                      onClick={() => {
                        const d = new Date(selectedDate);
                        d.setDate(d.getDate() - 1);
                        setSelectedDate(toYMD(d));
                      }}
                      className="p-1.5 rounded-md hover:bg-gray-100 transition"
                    >
                      <ChevronLeft className="w-4 h-4 text-gray-600" />
                    </button>
                    <span className="text-sm text-gray-700 px-2 font-medium">{formatDate(selectedDate)}</span>
                    <button
                      onClick={() => {
                        const d = new Date(selectedDate);
                        d.setDate(d.getDate() + 1);
                        setSelectedDate(toYMD(d));
                      }}
                      className="p-1.5 rounded-md hover:bg-gray-100 transition"
                    >
                      <ChevronRight className="w-4 h-4 text-gray-600" />
                    </button>
                  </div>
                )}
              </div>

              {viewMode === 'daily' ? renderDailyTimeline() : renderWeeklyView()}
            </div>
          </div>
        )}

        {/* 예약 목록 */}
        {activeTab === 'list' && renderList()}
      </div>

      {/* 모달들 */}
      {renderRoomModal()}
      {renderSuccessModal()}
    </div>
  );
}
