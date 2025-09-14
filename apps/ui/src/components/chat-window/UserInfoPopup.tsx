// // ok
// import React from "react";
// import { useLocalStorage } from "../../hooks/useLocalStorage";
// import { X } from 'lucide-react';

// interface UserInfoPopupConfig {
//   // Add any config properties you need
// }

// interface UserInfoPopupProps {
//   config?: UserInfoPopupConfig;
//   isOpen: boolean;
//   onSubmit: (name: string, email: string) => void;
//   onCancel: () => void;
// }

// export const UserInfoPopup: React.FC<UserInfoPopupProps> = ({ config, isOpen, onSubmit, onCancel }) => {
//   const [name, setName] = useLocalStorage('coolchat_customer_name', '');
//   const [email, setEmail] = useLocalStorage('coolchat_customer_email', '');

//   const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
//     const { name: fieldName, value } = e.target;
//     if (fieldName === 'name') {
//       setName(value);
//     } else if (fieldName === 'email') {
//       setEmail(value);
//     }
//   };

//   const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
//     e.preventDefault();
//     if (name.trim() && email.trim()) {
//       onSubmit(name.trim(), email.trim());
//       // Values are automatically saved by useLocalStorage hook
//     }
//   };

//   const handleCancel = () => {
//     onCancel();
//     // Optionally reset form or keep values for next time
//   };

//   if (!isOpen) return null;

//   return (
//     <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
//       <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
//         {/* Header */}
//         <div className="flex items-center justify-between p-6 border-b border-gray-200">
//           <h3 className="text-lg font-semibold text-gray-900">
//             Kết nối với nhân viên hỗ trợ
//           </h3>
//           <button
//             onClick={handleCancel}
//             className="p-1 hover:bg-gray-100 rounded-full transition-colors"
//           >
//             <X size={20} className="text-gray-500" />
//           </button>
//         </div>

//         {/* Content */}
//         <div className="p-6">
//           <p className="text-gray-600 mb-6">
//             Vui lòng cung cấp thông tin của bạn để kết nối với nhân viên hỗ trợ.
//           </p>

//           <form onSubmit={handleSubmit} className="space-y-4">
//             {/* Name Field */}
//             <div>
//               <label 
//                 htmlFor="name" 
//                 className="block text-sm font-medium text-gray-700 mb-1"
//               >
//                 Họ tên
//               </label>
//               <input
//                 type="text"
//                 id="name"
//                 name="name"
//                 value={name}
//                 onChange={handleInputChange}
//                 required
//                 placeholder="Họ tên của bạn"
//                 className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
//               />
//             </div>

//             {/* Email Field */}
//             <div>
//               <label 
//                 htmlFor="email" 
//                 className="block text-sm font-medium text-gray-700 mb-1"
//               >
//                 Email
//               </label>
//               <input
//                 type="email"
//                 id="email"
//                 name="email"
//                 value={email}
//                 onChange={handleInputChange}
//                 required
//                 placeholder="Email của bạn"
//                 className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
//               />
//             </div>

//             {/* Actions */}
//             <div className="flex gap-3 pt-4">
//               <button
//                 type="button"
//                 onClick={handleCancel}
//                 className="flex-1 px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
//               >
//                 Hủy
//               </button>
//               <button
//                 type="submit"
//                 className="flex-1 px-4 py-2 bg-blue-500 text-white hover:bg-blue-600 rounded-md transition-colors"
//               >
//                 Kết nối
//               </button>
//             </div>
//           </form>
//         </div>
//       </div>
//     </div>
//   );
// };


// export default UserInfoPopup;

import React from 'react';

interface Props {
  name: string;
  email: string;
  onChangeName: (value: string) => void;
  onChangeEmail: (value: string) => void;
  onCancel: () => void;
  onSubmit: () => void;
}

export const UserInfoPopup: React.FC<Props> = ({
  name,
  email,
  onChangeName,
  onChangeEmail,
  onCancel,
  onSubmit
}) => {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-80 max-w-sm mx-4">
        <h3 className="text-lg font-medium mb-4">Thông tin liên hệ</h3>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Tên</label>
            <input
              type="text"
              value={name}
              onChange={(e) => onChangeName(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Nhập tên của bạn"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => onChangeEmail(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Nhập email của bạn"
            />
          </div>
        </div>
        <div className="flex space-x-3 mt-6">
          <button
            onClick={onCancel}
            className="flex-1 px-4 py-2 border rounded-lg hover:bg-gray-50 transition-colors"
          >
            Hủy
          </button>
          <button
            onClick={onSubmit}
            disabled={!name.trim() || !email.trim()}
            className="flex-1 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Xác nhận
          </button>
        </div>
      </div>
    </div>
  );
};
