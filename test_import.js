const XLSX = require('./server/node_modules/xlsx');

const BASE_URL = 'http://localhost:8632/api';

async function testImportFlow() {
  console.log('=== 开始测试批量导入功能 ===\n');

  let authToken;

  // 1. 登录
  console.log('1. 登录教师账号...');
  try {
    const loginRes = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'teacher', password: 'teacher123' })
    });
    const data = await loginRes.json();
    if (!loginRes.ok) throw new Error(data.error || '登录失败');
    authToken = data.token;
    console.log('   ✅ 登录成功');
  } catch (err) {
    console.log('   ❌ 登录失败:', err.message);
    return;
  }

  const authHeaders = {
    'Authorization': `Bearer ${authToken}`
  };

  // 2. 下载模板 (GET)
  console.log('\n2. 下载导入模板 (GET)...');
  try {
    const templateRes = await fetch(`${BASE_URL}/questions/import/template`, {
      headers: authHeaders
    });
    if (!templateRes.ok) {
      const errData = await templateRes.json();
      throw new Error(errData.error || `HTTP ${templateRes.status}`);
    }
    
    const buffer = Buffer.from(await templateRes.arrayBuffer());
    const contentType = templateRes.headers.get('content-type');
    const contentDisposition = templateRes.headers.get('content-disposition');
    
    console.log('   ✅ 模板下载成功');
    console.log(`   内容类型: ${contentType}`);
    console.log(`   Content-Disposition: ${contentDisposition}`);
    console.log(`   文件大小: ${buffer.length} bytes`);
    
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const sheetData = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], { header: 1 });
    console.log(`   列名: ${sheetData[0].join(', ')}`);
    console.log(`   示例行数: ${sheetData.length - 1} 行示例数据`);
  } catch (err) {
    console.log('   ❌ 模板下载失败:', err.message);
  }

  // 3. 创建测试 Excel 文件
  console.log('\n3. 创建测试 Excel 文件...');
  const testData = [
    ['题型', '难度', '题目', 'A', 'B', 'C', 'D', '正确答案', '解析', '分值', '知识点'],
    ['单选题', '简单', '测试导入单选题1？', '选项A', '选项B', '选项C', '选项D', 'B', '正确答案是B', 2, '测试知识点1'],
    ['单选题', '中等', '测试导入单选题2？', '选项A', '选项B', '选项C', '选项D', 'C', '正确答案是C', 3, '测试知识点2'],
    ['多选题', '中等', '测试导入多选题？', '正确A', '正确B', '错误C', '正确D', 'A,B,D', 'ABD是正确答案', 4, '测试知识点3'],
    ['判断题', '简单', '测试导入判断题？', '', '', '', '', '对', '是对的', 1, '测试知识点4'],
    ['填空题', '中等', '测试导入填空__题？', '', '', '', '', '测试答案', '这是解析', 2, '测试知识点5']
  ];
  
  const worksheet = XLSX.utils.aoa_to_sheet(testData);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, '题目');
  const excelBuffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
  console.log('   ✅ 测试文件创建成功');
  console.log(`   共 ${testData.length - 1} 道测试题`);

  // 4. 预览导入
  console.log('\n4. 预览导入 (multipart/form-data)...');
  try {
    const formData = new FormData();
    const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    formData.append('file', blob, 'test_import.xlsx');
    
    const previewRes = await fetch(`${BASE_URL}/questions/import/preview`, {
      method: 'POST',
      headers: { ...authHeaders },
      body: formData
    });
    
    if (!previewRes.ok) {
      const errData = await previewRes.json();
      throw new Error(errData.error || `HTTP ${previewRes.status}`);
    }
    
    const previewData = await previewRes.json();
    
    console.log('   ✅ 预览成功');
    console.log(`   总题数: ${previewData.total}`);
    console.log(`   有效题数: ${previewData.valid}`);
    console.log(`   无效题数: ${previewData.invalid}`);
    console.log(`   文件内重复: ${previewData.fileDuplicates}`);
    console.log(`   库内重复: ${previewData.dbDuplicates}`);
    
    if (previewData.validQuestions && previewData.validQuestions.length > 0) {
      const q1 = previewData.validQuestions[0];
      console.log('\n   第1题验证 (单选题，正确答案应为B):');
      console.log(`     题型: ${q1.type}`);
      console.log(`     题目: ${q1.content}`);
      console.log(`     选项数: ${q1.options?.length || 0}`);
      console.log(`     正确答案字段: ${q1.correctAnswer}`);
      
      if (q1.options) {
        q1.options.forEach(opt => {
          console.log(`       ${opt.label}: ${opt.content} [正确: ${opt.isCorrect}]`);
        });
      }
      
      const correctOptions = q1.options?.filter(o => o.isCorrect);
      const isCorrectMatch = correctOptions?.length === 1 && correctOptions[0].label === 'B';
      console.log(`     ✅ 正确选项标记正确？ ${isCorrectMatch ? '是' : '否'}`);
      
      const q3 = previewData.validQuestions[2];
      console.log('\n   第3题验证 (多选题，正确答案应为A,B,D):');
      console.log(`     题型: ${q3.type}`);
      console.log(`     正确答案字段: ${q3.correctAnswer}`);
      if (q3.options) {
        q3.options.forEach(opt => {
          console.log(`       ${opt.label}: ${opt.content} [正确: ${opt.isCorrect}]`);
        });
      }
      const multiCorrect = q3.options?.filter(o => o.isCorrect).map(o => o.label).sort();
      console.log(`     标记正确的选项: ${multiCorrect?.join(', ')}`);
      console.log(`     ✅ 多选正确选项标记正确？ ${multiCorrect?.join(',') === 'A,B,D' ? '是' : '否'}`);
    }
  } catch (err) {
    console.log('   ❌ 预览失败:', err.message);
  }

  // 5. 获取科目列表
  console.log('\n5. 获取科目列表...');
  let subjectId;
  try {
    const subjectsRes = await fetch(`${BASE_URL}/questions/subjects`, {
      headers: authHeaders
    });
    const subjects = await subjectsRes.json();
    console.log(`   共 ${subjects.length} 个科目`);
    const jsSubject = subjects.find(s => s.name === 'JavaScript');
    if (jsSubject) {
      subjectId = jsSubject.id;
      console.log(`   使用科目: JavaScript (${subjectId})`);
    } else {
      subjectId = subjects[0].id;
      console.log(`   使用第一个科目: ${subjects[0].name}`);
    }
  } catch (err) {
    console.log('   ❌ 获取科目失败:', err.message);
    return;
  }

  // 6. 执行导入
  console.log('\n6. 执行题目导入...');
  try {
    const formData = new FormData();
    const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    formData.append('file', blob, 'test_import.xlsx');
    formData.append('subjectId', subjectId);
    
    const importRes = await fetch(`${BASE_URL}/questions/import`, {
      method: 'POST',
      headers: { ...authHeaders },
      body: formData
    });
    
    if (!importRes.ok) {
      const errData = await importRes.json();
      throw new Error(errData.error || `HTTP ${importRes.status}`);
    }
    
    const importData = await importRes.json();
    
    console.log('   ✅ 导入成功');
    console.log(`   导入数量: ${importData.imported}`);
    console.log(`   跳过数量: ${importData.skipped}`);
    console.log(`   无效数量: ${importData.invalid}`);
    console.log(`   总题数: ${importData.total}`);
    
    if (importData.questions && importData.questions.length > 0) {
      const importedQ = importData.questions[0];
      console.log('\n   验证导入的第一道题 (单选题，正确答案应为B):');
      console.log(`     ID: ${importedQ.id}`);
      console.log(`     题型: ${importedQ.type}`);
      console.log(`     correctAnswer字段: ${importedQ.correctAnswer}`);
      console.log(`     选项数: ${importedQ.options?.length || 0}`);
      
      if (importedQ.options) {
        importedQ.options.forEach(opt => {
          console.log(`       ${opt.label}: ${opt.content} [正确: ${opt.isCorrect}]`);
        });
      }
      
      const correctOpts = importedQ.options?.filter(o => o.isCorrect);
      console.log(`     ✅ 正确答案是B？ ${correctOpts?.length === 1 && correctOpts[0].label === 'B' ? '是' : '否'}`);
      
      if (importData.questions[1]) {
        const q2 = importData.questions[1];
        console.log('\n   验证导入的第二道题 (单选题，正确答案应为C):');
        console.log(`     correctAnswer字段: ${q2.correctAnswer}`);
        const q2Correct = q2.options?.filter(o => o.isCorrect);
        console.log(`     标记正确的选项: ${q2Correct?.map(o => o.label).join(', ')}`);
        console.log(`     ✅ 正确答案是C？ ${q2Correct?.length === 1 && q2Correct[0].label === 'C' ? '是' : '否'}`);
      }
      
      if (importData.questions[2]) {
        const q3 = importData.questions[2];
        console.log('\n   验证导入的第三道题 (多选题，正确答案应为A,B,D):');
        console.log(`     correctAnswer字段: ${q3.correctAnswer}`);
        const q3Correct = q3.options?.filter(o => o.isCorrect);
        console.log(`     标记正确的选项: ${q3Correct?.map(o => o.label).sort().join(', ')}`);
        console.log(`     ✅ 正确答案是A,B,D？ ${q3Correct?.map(o => o.label).sort().join(',') === 'A,B,D' ? '是' : '否'}`);
      }
    }
  } catch (err) {
    console.log('   ❌ 导入失败:', err.message);
  }

  console.log('\n=== 测试完成 ===');
}

testImportFlow().catch(console.error);
