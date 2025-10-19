import React, { useState } from 'react';
import { X, Calendar, MapPin } from 'lucide-react';

export default function MeetingRoomReservation() {
  const rooms = ['A회의실', 'B회의실', 'C회의실'];
  const hours = Array.from({ length: 9 }, (_, i) => 9 + i);

  const [reservations, setReservations] = useState([
    { id: 1, room: 'A회의실', startHour: 10, endHour: 11, name: '김철수', purpose: '마케팅 전략 회의' },
    { id: 2, room: 'A회의실', startHour: 14, endHour: 16, name: '이영미', purpose: '분기 실적 검토' },
    { id: 3, room: 'B회의실', startHour: 9, endHour: 10, name: '박준호', purpose: '개발팀 스탠드업' },
    { id: 4, room: 'C회의실', startHour: 13, endHour: 15, name: '정수영', purpose: '클라이언트 미팅' },
  ]);

  const [selectedRoom, setSelectedRoom] = useState(rooms[0]);
  const [startHour, setStartHour] = useState(9);
  const [endHour, setEndHour] = useState(10);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({ name: '', purpose: '' });
  const [hoveredReservation, setHoveredReservation] = useState(null);
  const [tooltipPos, setTooltipPos] = useState(null);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [lastReservation, setLastReservation] = useState(null);

  const isTimeRangeAvailable = (room, start, end) => {
    return !reservations.some(res => 
      res.room === room && !(res.endHour <= start || res.startHour >= end)
    );
  };

  const canReserve = isTimeRangeAvailable(selectedRoom, startHour, endHour) && startHour < endHour;

  const handleReserve = () => {
    if (!formData.name || !formData.purpose) {
      alert('예약자명과 사용목적을 입력해주세요.');
      return;
    }

    const newReservation = {
      id: Math.max(...reservations.map(r => r.id), 0) + 1,
      room: selectedRoom,
      startHour: startHour,
      endHour: endHour,
      name: formData.name,
      purpose: formData.purpose,
    };

    setReservations([...reservations, newReservation]);
    setFormData({ name: '', purpose: '' });
    setShowForm(false);
  };

  const handleCancel = (id) => {
    setReservations(reservations.filter(res => res.id !== id));
  };

  const handleMouseEnter = (reservation, e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setTooltipPos({ top: rect.top - 10, left: rect.left + rect.width / 2 });
    setHoveredReservation(reservation);
  };

  const handleMouseLeave = () => {
    setHoveredReservation(null);
  };

  const getHourWidth = (start, end) => {
    return `${(end - start) * 100}%`;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-8">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-800 mb-2 flex items-center gap-2">
            <Calendar className="w-8 h-8 text-indigo-600" />
            회의실 예약 시스템
          </h1>
          <p className="text-gray-600">회의실과 시간 범위를 선택하여 예약하세요</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* 예약 양식 */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg shadow-lg p-6 sticky top-8">
              <h2 className="text-xl font-bold text-gray-800 mb-4">예약하기</h2>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">회의실</label>
                <select
                  value={selectedRoom}
                  onChange={(e) => setSelectedRoom(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  {rooms.map(room => (
                    <option key={room} value={room}>{room}</option>
                  ))}
                </select>
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">시작 시간</label>
                <select
                  value={startHour}
                  onChange={(e) => {
                    const newStart = parseInt(e.target.value);
                    setStartHour(newStart);
                    if (newStart >= endHour) {
                      setEndHour(newStart + 1);
                    }
                  }}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  {hours.map(hour => (
                    <option key={hour} value={hour}>{hour}:00</option>
                  ))}
                </select>
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">종료 시간</label>
                <select
                  value={endHour}
                  onChange={(e) => setEndHour(parseInt(e.target.value))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  {hours.map(hour => (
                    <option key={hour} value={hour} disabled={hour <= startHour}>
                      {hour}:00 {hour <= startHour ? '(불가)' : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div className="mb-4 p-3 bg-gray-100 rounded-lg">
                <p className="text-sm text-gray-600">
                  <span className="font-medium">{startHour}:00 ~ {endHour}:00</span>
                  <br />
                  (<span className="text-indigo-600 font-medium">{endHour - startHour}시간</span>)
                </p>
              </div>

              {!canReserve && startHour < endHour && (
                <div className="mb-4 p-2 bg-red-100 text-red-700 text-xs rounded">
                  해당 시간대는 이미 예약되어 있습니다.
                </div>
              )}

              {!showForm ? (
                <button
                  onClick={() => setShowForm(true)}
                  disabled={!canReserve}
                  className="w-full bg-indigo-600 text-white py-2 rounded-lg font-medium hover:bg-indigo-700 transition disabled:bg-gray-400 disabled:cursor-not-allowed"
                >
                  예약 진행
                </button>
              ) : (
                <div className="space-y-3">
                  <input
                    type="text"
                    placeholder="예약자명"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <textarea
                    placeholder="사용목적"
                    value={formData.purpose}
                    onChange={(e) => setFormData({ ...formData, purpose: e.target.value })}
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
                      className="flex-1 bg-gray-300 text-gray-700 py-2 rounded-lg font-medium hover:bg-gray-400 transition text-sm"
                    >
                      취소
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* 예약 현황 */}
          <div className="lg:col-span-3">
            <div className="bg-white rounded-lg shadow-lg p-6 overflow-x-auto">
              <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
                <MapPin className="w-5 h-5 text-indigo-600" />
                예약 현황
              </h2>

              <div className="space-y-4">
                {rooms.map(room => (
                  <div key={room}>
                    <h3 className="font-bold text-gray-700 mb-2">{room}</h3>
                    <div className="relative bg-gray-100 rounded-lg h-16 border border-gray-300">
                      {/* 시간 눈금 */}
                      <div className="absolute top-0 left-0 right-0 flex h-full">
                        {hours.map(hour => (
                          <div
                            key={hour}
                            className="flex-1 border-r border-gray-300 relative"
                          >
                            <span className="absolute -top-6 left-1/2 transform -translate-x-1/2 text-xs text-gray-600 font-medium">
                              {hour}
                            </span>
                          </div>
                        ))}
                      </div>

                      {/* 예약 블록 */}
                      <div className="absolute top-0 left-0 right-0 h-full">
                        {reservations
                          .filter(res => res.room === room)
                          .map(reservation => {
                            const startPercent = ((reservation.startHour - 9) / 9) * 100;
                            const widthPercent = ((reservation.endHour - reservation.startHour) / 9) * 100;
                            return (
                              <div
                                key={reservation.id}
                                onMouseEnter={(e) => handleMouseEnter(reservation, e)}
                                onMouseLeave={handleMouseLeave}
                                className="absolute top-1 bottom-1 bg-indigo-500 rounded-md flex items-center justify-center cursor-pointer hover:bg-indigo-600 transition group"
                                style={{
                                  left: `${startPercent}%`,
                                  width: `${widthPercent}%`,
                                }}
                              >
                                <span className="text-white font-bold text-xs truncate px-2">
                                  {reservation.startHour}~{reservation.endHour}
                                </span>
                                {hoveredReservation?.id === reservation.id && tooltipPos && (
                                  <div
                                    className="fixed z-50 bg-gray-800 text-white rounded-lg px-3 py-2 text-xs whitespace-nowrap transform -translate-x-1/2"
                                    style={{ top: `${tooltipPos.top - 40}px`, left: `${tooltipPos.left}px` }}
                                  >
                                    <div className="font-bold">{reservation.name}</div>
                                    <div>{reservation.purpose}</div>
                                    <div className="text-gray-400 mt-1">{reservation.startHour}:00 ~ {reservation.endHour}:00</div>
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
                          })}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}