#!/usr/bin/env python3

file_path = 'frontend/src/pages/admin/UserForm.jsx'

with open(file_path, 'r') as f:
    content = f.read()

# Check if fix is already applied
if 'const cleanedData = {' in content:
    print("✅ Fix already applied!")
    exit(0)

print("🔧 Applying fix...")

old_code = '''    setSaving(true);
    try {
      if (isEditing) {
        await userAPI.updateUser(id, formData);
        toast.success('User updated successfully');
      } else {
        await userAPI.createUser(formData);
        toast.success('User created successfully');
      }'''

new_code = '''    setSaving(true);
    try {
      // Clean up empty string values - convert to null for UUID fields
      const cleanedData = {
        ...formData,
        roleId: formData.roleId || null,
        companyId: formData.companyId || null,
        departmentId: formData.departmentId || null,
      };

      if (isEditing) {
        await userAPI.updateUser(id, cleanedData);
        toast.success('User updated successfully');
      } else {
        await userAPI.createUser(cleanedData);
        toast.success('User created successfully');
      }'''

if old_code in content:
    content = content.replace(old_code, new_code)
    
    with open(file_path, 'w') as f:
        f.write(content)
    
    print("✅ Fix applied successfully!")
else:
    print("❌ Could not find exact pattern")

