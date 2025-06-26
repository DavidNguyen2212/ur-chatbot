import multer from 'multer'
// import path from 'path'
// import fs from 'fs'

// const avatarDir = 'uploads/avatars'

// if (!fs.existsSync(avatarDir)) {
//   fs.mkdirSync(avatarDir, { recursive: true })
// }

// const storage = multer.diskStorage({
//   destination: (req, file, cb) => {
//     cb(null, avatarDir)
//   },
//   filename: (req, file, cb) => {
//     const ext = path.extname(file.originalname)
//     const unique = Date.now() + '-' + Math.round(Math.random() * 1e9)
//     cb(null, unique + ext)
//   }
// })

export const uploadAvatarMiddleware = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith('image/')) {
      return cb(null, false)
    }
    cb(null, true)
  }
}).single('avatar')
