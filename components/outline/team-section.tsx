'use client';

import { useState } from 'react';

export interface TeamMember {
  id: string;
  name: string;
  role: string;
  expertise: string;
  availability: string;
}

interface TeamSectionProps {
  members: TeamMember[];
  onChange: (members: TeamMember[]) => void;
}

const ROLES = [
  '项目总监',
  '项目经理',
  '高级顾问',
  '顾问',
  '分析师',
  '实施专家',
  '培训师',
];

export default function TeamSection({
  members,
  onChange,
}: TeamSectionProps) {
  const [showForm, setShowForm] = useState(false);
  const [newMember, setNewMember] = useState<Partial<TeamMember>>({
    name: '',
    role: '顾问',
    expertise: '',
    availability: '全职',
  });

  const addMember = () => {
    if (!newMember.name?.trim()) return;

    const member: TeamMember = {
      id: `member_${Date.now()}`,
      name: newMember.name || '',
      role: newMember.role || '顾问',
      expertise: newMember.expertise || '',
      availability: newMember.availability || '全职',
    };

    onChange([...members, member]);
    setNewMember({
      name: '',
      role: '顾问',
      expertise: '',
      availability: '全职',
    });
    setShowForm(false);
  };

  const deleteMember = (id: string) => {
    onChange(members.filter(m => m.id !== id));
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h4 className="font-medium text-gray-900">项目团队</h4>
          <p className="text-sm text-gray-500 mt-1">
            根据项目需求配置合适的团队资源
          </p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          + 添加成员
        </button>
      </div>

      {/* Add Member Form */}
      {showForm && (
        <div className="bg-blue-50 rounded-lg p-4 space-y-3">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                姓名
              </label>
              <input
                type="text"
                value={newMember.name || ''}
                onChange={(e) => setNewMember({ ...newMember, name: e.target.value })}
                placeholder="成员姓名"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                角色
              </label>
              <select
                value={newMember.role || '顾问'}
                onChange={(e) => setNewMember({ ...newMember, role: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                {ROLES.map(role => (
                  <option key={role} value={role}>{role}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                专业领域
              </label>
              <input
                type="text"
                value={newMember.expertise || ''}
                onChange={(e) => setNewMember({ ...newMember, expertise: e.target.value })}
                placeholder="如：战略规划、组织变革"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                投入程度
              </label>
              <select
                value={newMember.availability || '全职'}
                onChange={(e) => setNewMember({ ...newMember, availability: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="全职">全职</option>
                <option value="兼职">兼职</option>
                <option value="按需">按需</option>
              </select>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button
              onClick={() => setShowForm(false)}
              className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-800"
            >
              取消
            </button>
            <button
              onClick={addMember}
              className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              添加
            </button>
          </div>
        </div>
      )}

      {/* Team Grid */}
      {members.length > 0 ? (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {members.map(member => (
            <div
              key={member.id}
              className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-sm transition-shadow"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  {/* Avatar */}
                  <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-medium">
                    {member.name.charAt(0)}
                  </div>
                  <div>
                    <div className="font-medium text-gray-900">{member.name}</div>
                    <div className="text-sm text-blue-600">{member.role}</div>
                  </div>
                </div>
                <button
                  onClick={() => deleteMember(member.id)}
                  className="text-gray-400 hover:text-red-500"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <div className="mt-3 space-y-1">
                {member.expertise && (
                  <div className="text-sm text-gray-600">
                    <span className="text-gray-400">专业：</span>
                    {member.expertise}
                  </div>
                )}
                <div className="text-sm text-gray-600">
                  <span className="text-gray-400">投入：</span>
                  {member.availability}
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="border-2 border-dashed border-gray-200 rounded-lg p-8 text-center">
          <div className="text-gray-400 text-4xl mb-2">👥</div>
          <div className="text-gray-500">暂无团队成员</div>
          <div className="text-sm text-gray-400 mt-1">
            点击上方"添加成员"按钮配置团队
          </div>
        </div>
      )}

      {/* Role Summary */}
      {members.length > 0 && (
        <div className="bg-gray-50 rounded-lg p-4">
          <h5 className="text-sm font-medium text-gray-700 mb-2">角色分布</h5>
          <div className="flex flex-wrap gap-2">
            {ROLES.map(role => {
              const count = members.filter(m => m.role === role).length;
              if (count === 0) return null;
              return (
                <span
                  key={role}
                  className="px-2 py-1 bg-white border border-gray-200 rounded text-sm"
                >
                  {role}: {count}人
                </span>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
