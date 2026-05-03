// Thay URL Web App của bạn vào biến VITE_ADMIN_API_URL trong file .env

function doPost(e) {
  var output = ContentService.createTextOutput();
  output.setMimeType(ContentService.MimeType.JSON);
  
  // Xử lý preflight request cho CORS
  if (!e.postData) {
    return output.setContent(JSON.stringify({status: 'success'}));
  }

  try {
    var action = e.parameter.action;
    
    if (action === 'get_classes') {
      return output.setContent(JSON.stringify(handleGetClasses(e.parameter.email)));
    } else if (action === 'sync_students') {
      var postData = JSON.parse(e.postData.contents);
      return output.setContent(JSON.stringify(handleSyncStudents(postData.email, postData.classes)));
    } else if (action === 'get_quizzes') {
      return output.setContent(JSON.stringify(handleGetQuizzes(e.parameter.email)));
    } else if (action === 'sync_quizzes') {
      var postData = JSON.parse(e.postData.contents);
      return output.setContent(JSON.stringify(handleSyncQuizzes(postData.email, postData.quizzes)));
    } else if (action === 'sync_results') {
      var postData = JSON.parse(e.postData.contents);
      return output.setContent(JSON.stringify(handleSyncResults(postData.email, postData.results)));
    } else if (action === 'get_users') {
      return output.setContent(JSON.stringify(handleGetUsers()));
    } else if (action === 'update_user_status') {
      var postData = JSON.parse(e.postData.contents);
      return output.setContent(JSON.stringify(handleUpdateUserStatus(postData.email, postData.status)));
    } else if (action === 'register_teacher') {
      var postData = JSON.parse(e.postData.contents);
      return output.setContent(JSON.stringify(handleRegisterTeacher(postData.email, postData.name, postData.password, postData.phone)));
    } else if (action === 'login_student') {
      var postData = JSON.parse(e.postData.contents);
      return output.setContent(JSON.stringify(handleLoginStudent(postData.studentId, postData.dob)));
    } else if (action === 'login_password') {
      var postData = JSON.parse(e.postData.contents);
      return output.setContent(JSON.stringify(handleLoginPassword(postData.email, postData.password)));
    } else if (action === 'update_profile') {
      var postData = JSON.parse(e.postData.contents);
      return output.setContent(JSON.stringify(handleUpdateProfile(postData.email, postData.name, postData.dob, postData.phone)));
    } else if (action === 'change_password') {
      var postData = JSON.parse(e.postData.contents);
      return output.setContent(JSON.stringify(handleChangePassword(postData.email, postData.oldPassword, postData.newPassword)));
    } else if (action === 'create_user_manual') {
      var postData = JSON.parse(e.postData.contents);
      return output.setContent(JSON.stringify(handleCreateUserManual(postData.email, postData.name, postData.password, postData.role)));
    } else if (action === 'report_cheat') {
      var postData = JSON.parse(e.postData.contents);
      return output.setContent(JSON.stringify(handleReportCheat(postData)));
    }
    return output.setContent(JSON.stringify({status: 'error', message: 'Invalid action'}));
  } catch (error) {
    return output.setContent(JSON.stringify({status: 'error', message: error.toString()}));
  }
}

function doGet(e) {
  var output = ContentService.createTextOutput();
  output.setMimeType(ContentService.MimeType.JSON);
  
  try {
    var action = e.parameter.action;
    var email = e.parameter.email;

    if (action === 'get_user') {
      return output.setContent(JSON.stringify(handleGet(email)));
    }
  } catch (error) {
    return output.setContent(JSON.stringify({status: 'error', message: error.toString()}));
  }
  return output.setContent(JSON.stringify({status: 'success', message: 'CORS OK'}));
}

// ==========================================
// HÀM BĂM MẬT KHẨU (BẢO MẬT SHA-256)
// ==========================================
function hashPassword(password) {
  var rawHash = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, password);
  return rawHash.map(function(byte) {
      return ('0' + (byte & 0xFF).toString(16)).slice(-2);
  }).join('');
}

function handleRegisterTeacher(email, name, password, phone) {
  if (!email || !password) return {status: 'error', message: 'Thiếu thông tin'};
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('GiaoVien');
  if (!sheet) {
    sheet = ss.insertSheet('GiaoVien');
    sheet.appendRow(['Email', 'Tên', 'Trạng thái', 'Ngày đăng ký', 'Mật khẩu', 'Số điện thoại', 'Ngày sinh', 'Vai trò']);
  }

  var data = sheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (data[i][0] === email) {
      return {status: 'error', message: 'Tài khoản Email này đã tồn tại!'};
    }
  }

  // Sử dụng Hash SHA-256 thay vì Base64
  var securedPassword = hashPassword(password);
  sheet.appendRow([email, name || '', 'Pending', new Date().toISOString(), securedPassword, phone || '', '', 'teacher']);
  return {status: 'pending', message: 'Tài khoản của bạn đã được gửi yêu cầu. Chờ Admin duyệt.'};
}

function handleLoginPassword(email, password) {
  if (!email || !password) return {status: 'error', message: 'Thiếu email hoặc mật khẩu'};
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('GiaoVien');
  if (!sheet) return {status: 'error', message: 'Tài khoản không tồn tại!'};

  var data = sheet.getDataRange().getValues();
  var securedPassword = hashPassword(password);
  var base64Legacy = Utilities.base64Encode(password); // Hỗ trợ nếu còn ai dùng base64 cũ

  for (var i = 1; i < data.length; i++) {
    if (data[i][0] === email) {
      var storedPassword = data[i][4].toString();
      
      // Cho phép đăng nhập nếu khớp: Mã SHA-256, mật khẩu văn bản thường (nhập tay trên sheet), hoặc mã Base64 cũ
      if (storedPassword !== securedPassword && storedPassword !== password && storedPassword !== base64Legacy) {
        return {status: 'error', message: 'Mật khẩu không chính xác!'};
      }
      
      if (data[i][2] === 'Approved') {
        var role = data[i][7] ? data[i][7].toString().trim().toLowerCase() : 'teacher';
        return {status: 'success', message: 'Đăng nhập thành công', user: {email: email, name: data[i][1], phone: data[i][5] || '', dob: data[i][6] || '', role: role}};
      } else {
        return {status: 'pending', message: 'Tài khoản của bạn đang chờ Admin duyệt. Vui lòng liên hệ Admin.'};
      }
    }
  }
  return {status: 'error', message: 'Tài khoản không tồn tại!'};
}

function handleUpdateProfile(email, name, dob, phone) {
  if (!email) return {status: 'error', message: 'Thiếu email'};
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('GiaoVien');
  if (!sheet) return {status: 'error', message: 'Lỗi hệ thống'};
  
  var data = sheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (data[i][0] === email) {
      if (name) sheet.getRange(i + 1, 2).setValue(name);
      if (phone) sheet.getRange(i + 1, 6).setValue(phone);
      if (dob) sheet.getRange(i + 1, 7).setValue(dob);
      return {status: 'success', message: 'Cập nhật thành công'};
    }
  }
  return {status: 'error', message: 'Không tìm thấy tài khoản'};
}

function handleChangePassword(email, oldPassword, newPassword) {
  if (!email || !oldPassword || !newPassword) return {status: 'error', message: 'Thiếu thông tin'};
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('GiaoVien');
  if (!sheet) return {status: 'error', message: 'Lỗi hệ thống'};
  
  var data = sheet.getDataRange().getValues();
  var securedOldPassword = hashPassword(oldPassword);
  var securedNewPassword = hashPassword(newPassword);
  var base64OldLegacy = Utilities.base64Encode(oldPassword);

  for (var i = 1; i < data.length; i++) {
    if (data[i][0] === email) {
      var storedPassword = data[i][4].toString();
      
      // Kiểm tra mật khẩu cũ (tương thích nhiều định dạng)
      if (storedPassword !== securedOldPassword && storedPassword !== oldPassword && storedPassword !== base64OldLegacy) {
        return {status: 'error', message: 'Mật khẩu hiện tại không chính xác'};
      }
      
      // Ghi đè mật khẩu mới bằng mã băm SHA-256 an toàn
      sheet.getRange(i + 1, 5).setValue(securedNewPassword);
      return {status: 'success', message: 'Đổi mật khẩu thành công'};
    }
  }
  return {status: 'error', message: 'Tài khoản không tồn tại!'};
}

function handleCreateUserManual(email, name, password, role) {
  if (!email || !password || !role) return {status: 'error', message: 'Thiếu thông bắt buộc'};
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('GiaoVien');
  if (!sheet) {
    sheet = ss.insertSheet('GiaoVien');
    sheet.appendRow(['Email', 'Tên', 'Trạng thái', 'Ngày đăng ký', 'Mật khẩu', 'Số điện thoại', 'Ngày sinh', 'Vai trò']);
  }

  var data = sheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (data[i][0] === email) {
      return {status: 'error', message: 'Tài khoản Email này đã tồn tại!'};
    }
  }

  // Sử dụng Hash SHA-256
  var securedPassword = hashPassword(password);
  // Manual creation is auto-approved
  sheet.appendRow([email, name || '', 'Approved', new Date().toISOString(), securedPassword, '', '', role]);
  return {status: 'success', message: 'Tạo tài khoản thành công.'};
}

function handleGet(email) {
  if (!email) return {status: 'error', message: 'Thiếu email'};
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('GiaoVien');
  if (!sheet) return {status: 'error', message: 'Tài khoản không tồn tại'};

  var data = sheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (data[i][0] === email) {
      var status = data[i][2];
      var role = data[i][7] ? data[i][7].toString().trim().toLowerCase() : 'teacher';
      return {status: status, user: {email: email, name: data[i][1], role: role, phone: data[i][5] || '', dob: data[i][6] || ''}};
    }
  }
  return {status: 'not_found', user: null};
}

function handleGetUsers() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('GiaoVien');
  if (!sheet) return {status: 'success', users: []};

  var data = sheet.getDataRange().getValues();
  var users = [];
  for (var i = 1; i < data.length; i++) {
    users.push({
      email: data[i][0],
      name: data[i][1],
      status: data[i][2],
      createdAt: data[i][3],
      role: data[i][7] ? data[i][7].toString().trim().toLowerCase() : 'teacher'
    });
  }
  return {status: 'success', users: users};
}

function handleUpdateUserStatus(email, status) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('GiaoVien');
  if (!sheet) return {status: 'error', message: 'Sheet GiaoVien không tồn tại'};

  var data = sheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (data[i][0] === email) {
      sheet.getRange(i + 1, 3).setValue(status);
      return {status: 'success'};
    }
  }
  return {status: 'error', message: 'Không tìm thấy user'};
}

function handleGetClasses(email) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('HocSinh');
  if (!sheet) return {status: 'success', classes: []};

  var data = sheet.getDataRange().getValues();
  var classMap = {}; 

  for (var i = 1; i < data.length; i++) {
    if (data[i][0] === email) {
      var classId = data[i][1];
      var className = data[i][2];
      if (!classMap[classId]) {
        classMap[classId] = { id: classId, name: className, students: [] };
      }
      if (data[i][3]) {
        classMap[classId].students.push({
          id: data[i][3],
          name: data[i][4],
          dob: data[i][5],
          phone: data[i][6],
          address: data[i][7]
        });
      }
    }
  }
  
  var classes = Object.keys(classMap).map(function(k) { return classMap[k]; });
  return {status: 'success', classes: classes};
}

function handleSyncStudents(email, classes) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('HocSinh');
  
  if (!sheet) {
    sheet = ss.insertSheet('HocSinh');
    sheet.appendRow(['Email Giáo viên', 'Mã Lớp', 'Tên Lớp', 'Mã Học Sinh', 'Họ và Tên', 'Ngày Sinh', 'SĐT Phụ Huynh', 'Địa Chỉ']);
  }
  
  var data = sheet.getDataRange().getValues();
  var rowsToDelete = [];
  for (var i = data.length - 1; i >= 1; i--) {
    if (data[i][0] === email) {
      rowsToDelete.push(i + 1);
    }
  }
  
  rowsToDelete.forEach(function(row) {
    sheet.deleteRow(row);
  });
  
  classes.forEach(function(cls) {
    if (cls.students && cls.students.length > 0) {
      cls.students.forEach(function(student) {
        sheet.appendRow([email, cls.id, cls.name, student.id, student.name, student.dob, student.phone, student.address]);
      });
    } else {
      sheet.appendRow([email, cls.id, cls.name, '', '', '', '', '']);
    }
  });
  
  return {status: 'success'};
}

function handleLoginStudent(studentId, dob) {
  if (!studentId) return {status: 'error', message: 'Thiếu mã học sinh'};
  
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('HocSinh');
  if (!sheet) return {status: 'error', message: 'Không có dữ liệu học sinh'};

  var data = sheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (data[i][3].toString() === studentId) {
      if (dob && data[i][5].toString() !== dob) {
        return {status: 'error', message: 'Ngày sinh không trùng khớp'};
      }
      return {
        status: 'success', 
        student: {
          id: data[i][3].toString(),
          name: data[i][4].toString(),
          classId: data[i][1].toString(),
          className: data[i][2].toString(),
          teacherEmail: data[i][0].toString()
        }
      };
    }
  }
  return {status: 'error', message: 'Không tìm thấy mã học sinh này'};
}

function handleGetQuizzes(email) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('KyThi');
  if (!sheet) return {status: 'success', quizzes: []};

  var data = sheet.getDataRange().getValues();
  var quizzes = [];

  for (var i = 1; i < data.length; i++) {
    if (data[i][0] === email) {
      quizzes.push({
        id: data[i][1],
        examName: data[i][2],
        classes: JSON.parse(data[i][3] || '[]'),
        examDate: data[i][4],
        duration: data[i][5],
        status: data[i][6],
        config: JSON.parse(data[i][7] || '{}'),
        versions: JSON.parse(data[i][8] || '[]'),
        createdAt: data[i][9]
      });
    }
  }
  
  return {status: 'success', quizzes: quizzes};
}

function handleSyncQuizzes(email, quizzes) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('KyThi');
  
  if (!sheet) {
    sheet = ss.insertSheet('KyThi');
    sheet.appendRow(['Email Giáo viên', 'ID Kỳ thi', 'Tên Kỳ thi', 'Lớp áp dụng', 'Ngày thi', 'Thời gian (phút)', 'Trạng thái', 'Cấu hình điểm', 'Các mã đề', 'Ngày tạo']);
  }
  
  quizzes.forEach(function(quiz) {
    if(!quiz.versions || quiz.versions.length === 0) {
       quiz.versions = [{ code: "101", pdfUrl: "", answers: { part1: {}, part2: {}, part3: {} } }]; 
    }
  });

  var data = sheet.getDataRange().getValues();
  var rowsToDelete = [];
  for (var i = data.length - 1; i >= 1; i--) {
    if (data[i][0] === email) {
      rowsToDelete.push(i + 1);
    }
  }
  
  rowsToDelete.forEach(function(row) {
    sheet.deleteRow(row);
  });
  
  quizzes.forEach(function(quiz) {
    sheet.appendRow([
      email, 
      quiz.id, 
      quiz.examName, 
      JSON.stringify(quiz.classes || []), 
      quiz.examDate, 
      quiz.duration, 
      quiz.status, 
      JSON.stringify(quiz.config || {}),
      JSON.stringify(quiz.versions || []),
      quiz.createdAt
    ]);
  });
  
  return {status: 'success'};
}

function handleSyncResults(email, results) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('KetQuaThi');
  
  if (!sheet) {
    sheet = ss.insertSheet('KetQuaThi');
    sheet.appendRow(['ID Kỳ thi', 'Mã Học sinh', 'Tên Học sinh', 'Mã Đề', 'Điểm', 'Thời gian nộp', 'Chi tiết nộp (JSON)']);
  }
  
  results.forEach(function(r) {
    sheet.appendRow([
      r.examId,
      r.studentId,
      r.studentName,
      r.versionCode,
      r.score,
      r.submittedAt,
      JSON.stringify(r.submissionDetails || {})
    ]);
  });
  
  return {status: 'success'};
}

function handleReportCheat(data) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('CanhBaoGianLan');
  
  if (!sheet) {
    sheet = ss.insertSheet('CanhBaoGianLan');
    sheet.appendRow(['Thời gian', 'Email Giáo viên', 'Tên bài thi', 'Lớp', 'Mã Học sinh', 'Tên Học sinh', 'Số lần vi phạm', 'Trạng thái']);
    sheet.setFrozenRows(1);
    sheet.getRange(1, 1, 1, 8).setFontWeight('bold');
  }
  
  sheet.appendRow([
    new Date().toLocaleString('vi-VN'),
    data.teacherEmail || '',
    data.examName || '',
    data.className || '',
    data.studentId || '',
    data.studentName || '',
    data.violationCount || 0,
    data.violationCount >= 3 ? 'BỊ HUỶ BÀI' : 'Cảnh báo'
  ]);
  
  return {status: 'success'};
}